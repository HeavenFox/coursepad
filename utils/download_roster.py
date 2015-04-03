import simplejson
import glob
import xml.etree.ElementTree as et
import re
import os
import sys
import urllib

data_folder = sys.argv[1]
semester = sys.argv[2]
base = os.path.join(data_folder, 'raw_roster')

existing_sns = [int(os.path.basename(fn).split('_')[1]) for fn in glob.glob(os.path.join(base, '*')) if os.path.basename(fn).startswith(semester)]
if len(existing_sns) == 0:
	cur_sn = 1
else:
	cur_sn = max(existing_sns) + 1
	
print cur_sn

base_dir = os.path.join(base, semester + '_' + str(cur_sn))

try:
    os.makedirs(base_dir)
    os.makedirs(os.path.join(base_dir, 'subjects'))
except:
    pass

xml_path = os.path.join(base_dir, 'subjects.xml')

urllib.urlretrieve('https://courseroster.reg.cornell.edu/courses/roster/' + semester.upper() + '/xml', xml_path)


# subjectlist

all_subjects_xml = et.parse(open(xml_path, 'r'))

for node in all_subjects_xml.getroot():
    print "downloading " + node.get('subject') 
    urllib.urlretrieve(node.get('xml'), os.path.join(base_dir, 'subjects', node.get('subject') + '.xml'))
