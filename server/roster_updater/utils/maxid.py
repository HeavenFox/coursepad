import sys
import simplejson

f = open(sys.argv[1], 'r')
json = simplejson.load(f)
print max(k['id'] for k in json['roster'])