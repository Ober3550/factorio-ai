# The process of encoding/decoding a blueprint

````python
def getBlueprintString(self):
    stringedBlueprint = json.dumps(self.__bluestring_json)
    compressedBlueprint = zlib.compress(stringedBlueprint.encode("utf8"))
    encodedBlueprint = base64.b64encode(compressedBlueprint)
    encodedBlueprint = "0" + encodedBlueprint.decode("utf8")
    return encodedBlueprint
````
