import simplejson
import glob
import xml.etree.ElementTree as et
import re
import os
import sys
import urllib

data_folder = sys.argv[1]
base = os.path.join(data_folder, 'raw_roster')

cur_sn = max(int(os.path.basename(fn).split('_')[1]) for fn in glob.glob(os.path.join(base, '*'))) + 1
print cur_sn


# subjectlist

# all_subjects_xml = et.parse(sys.stdin)

# for node in all_subjects_xml.getroot():
#     print "downloading " + node.get('subject') 
#     urllib.urlretrieve(node.get('xml'), os.path.join(sys.argv[1], node.get('subject') + '.xml'))