import { Builder, By, until, WebDriver } from 'selenium-webdriver'
import { createRequire } from 'module'
import type { ProductionRequirement } from '../models/production-requirement.js'
import { createProductionRequirement } from '../models/production-requirement.js'

const require = createRequire(import.meta.url)

export interface SeleniumOptions {
  headless?: boolean
  timeout?: number // milliseconds
  browser?: 'chrome' | 'firefox'
}

export class SeleniumCalculatorService {
  private options: Required<SeleniumOptions>

  constructor(options: SeleniumOptions = {}) {
    this.options = {
      headless: options.headless ?? true,
      timeout: options.timeout ?? 10000,
      browser: options.browser ?? 'chrome'
    }
  }

  // Query calculator and extract production requirements
  async queryCalculator(
    calculatorUrl: string,
    targetItem: string,
    targetRate: number,
    rateUnit: string,
    factorioVersion: string
  ): Promise<ProductionRequirement> {
    let driver: WebDriver | null = null

    try {
      // Build WebDriver
      const builder = new Builder().forBrowser(this.options.browser)

      if (this.options.headless) {
        // Load chrome options for headless mode
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chrome: any = require('selenium-webdriver/chrome')
        const options = new chrome.Options()
        options.addArguments('--headless', '--disable-gpu', '--no-sandbox')
        builder.setChromeOptions(options)
      }

      driver = await builder.build()

      // Navigate to calculator
      await driver.get(calculatorUrl)

      // Wait for page to load
      await driver.wait(until.elementLocated(By.css('#totals')), this.options.timeout)
      
      // Give time for JavaScript to populate the results table
      await driver.sleep(3000)
      
      // Verify the table has data
      const displayGroups = await driver.findElements(By.css('tbody.display-group'))
      if (displayGroups.length === 0) {
        throw new Error('Calculator results table not populated. Page may need more time to render.')}


      // Extract machine counts from the page
      // This is a placeholder implementation - actual selectors need to be determined
      const machines = await this.extractMachines(driver)
      const inputs = await this.extractInputs(driver)
      const dependencies = await this.extractDependencies(driver)

      // Create production requirement
      return createProductionRequirement(
        targetItem,
        targetRate,
        rateUnit,
        calculatorUrl,
        factorioVersion,
        machines,
        inputs,
        dependencies
      )
    } catch (error: any) {
      throw new Error(`Calculator query failed: ${error.message}`)
    } finally {
      if (driver) {
        await driver.quit()
      }
    }
  }

  // Extract machine requirements from calculator page
  private async extractMachines(driver: WebDriver): Promise<Array<{ type: string; recipe: string; count: number }>> {
    try {
      const machines: Array<{ type: string; recipe: string; count: number }> = []
      
      // Find all display rows (excluding breakdown rows)
      const rows = await driver.findElements(By.css('#totals tbody.display-group tr.display-row'))
      
      for (const row of rows) {
        try {
          // Get the item/recipe name from the icon's alt attribute
          const itemIcon = await row.findElement(By.css('td.item-icon img.icon'))
          const recipe = await itemIcon.getAttribute('alt')
          
          // Get machine type from building icon
          const buildingIcon = await row.findElement(By.css('td.building-icon img.icon'))
          const type = await buildingIcon.getAttribute('alt')
          
          // Get machine count
          const countElement = await row.findElement(By.css('tt.building-count'))
          const countText = (await countElement.getText()).trim()
          const count = parseFloat(countText)
          
          if (recipe && type && !isNaN(count)) {
            machines.push({ type, recipe, count })
          }
        } catch (rowError) {
          // Skip rows that don't have the expected structure
          continue
        }
      }
      
      return machines
    } catch (error) {
      console.error('Error extracting machines:', error)
      return []
    }
  }

  // Extract input resource requirements
  private async extractInputs(driver: WebDriver): Promise<Array<{ resource: string; rate: number }>> {
    try {
      const inputs: Array<{ resource: string; rate: number }> = []
      const seenResources = new Set<string>()
      
      // Look at all display rows to find ones with mining drills (raw resources)
      const displayGroups = await driver.findElements(By.css('#totals tbody.display-group'))
      
      for (const group of displayGroups) {
        try {
          const row = await group.findElement(By.css('tr.display-row'))
          
          // Check if this row has a mining drill as the building type
          const buildingIcon = await row.findElement(By.css('td.building-icon img.icon'))
          const buildingType = await buildingIcon.getAttribute('alt')
          
          if (buildingType && buildingType.toLowerCase().includes('mining drill')) {
            // This is a raw resource - get its name and rate
            const itemIcon = await row.findElement(By.css('td.item-icon img.icon'))
            const resource = await itemIcon.getAttribute('alt')
            
            const rateElement = await row.findElement(By.css('tt.item-rate'))
            const rateText = (await rateElement.getText()).trim()
            const rate = parseFloat(rateText)
            
            if (resource && !isNaN(rate) && !seenResources.has(resource)) {
              inputs.push({ resource, rate })
              seenResources.add(resource)
            }
          }
        } catch (groupError) {
          continue
        }
      }
      
      return inputs
    } catch (error) {
      console.error('Error extracting inputs:', error)
      return []
    }
  }

  // Extract intermediate dependencies
  private async extractDependencies(driver: WebDriver): Promise<Array<{ item: string; rate: number }>> {
    try {
      const dependencies: Array<{ item: string; rate: number }> = []
      const seenItems = new Set<string>()
      
      // Find all display rows except the first one (which is our target item)
      const displayGroups = await driver.findElements(By.css('#totals tbody.display-group'))
      
      // Skip the first group (target item), iterate through intermediate products
      for (let i = 1; i < displayGroups.length; i++) {
        try {
          const group = displayGroups[i]
          if (!group) continue
          const row = await group.findElement(By.css('tr.display-row'))
          
          // Get item name
          const itemIcon = await row.findElement(By.css('td.item-icon img.icon'))
          const item = await itemIcon.getAttribute('alt')
          
          // Get rate
          const rateElement = await row.findElement(By.css('tt.item-rate'))
          const rateText = (await rateElement.getText()).trim()
          const rate = parseFloat(rateText)
          
          if (item && !isNaN(rate) && !seenItems.has(item)) {
            dependencies.push({ item, rate })
            seenItems.add(item)
          }
        } catch (groupError) {
          continue
        }
      }
      
      return dependencies
    } catch (error) {
      console.error('Error extracting dependencies:', error)
      return []
    }
  }

  // Test if Selenium is working (useful for debugging)
  async testConnection(): Promise<boolean> {
    let driver: WebDriver | null = null

    try {
      const builder = new Builder().forBrowser(this.options.browser)

      if (this.options.headless) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chrome: any = require('selenium-webdriver/chrome')
        const options = new chrome.Options()
        options.addArguments('--headless', '--disable-gpu', '--no-sandbox')
        builder.setChromeOptions(options)
      }

      driver = await builder.build()
      await driver.get('https://www.google.com')
      const title = await driver.getTitle()
      return title.toLowerCase().includes('google')
    } catch (error) {
      console.error('Selenium connection test failed:', error)
      return false
    } finally {
      if (driver) {
        await driver.quit()
      }
    }
  }
}
