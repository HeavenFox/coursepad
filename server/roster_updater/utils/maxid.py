import sys
import json

f = open(sys.argv[1], 'r')
data = json.load(f)
print(max(k['id'] for k in data['roster']))
