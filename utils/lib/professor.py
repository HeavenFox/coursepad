

"""

profs = []

prof_vcards = glob.glob('profs/*.vcard')
for vcard in prof_vcards:
    bn = os.path.basename(vcard)
    netid = bn[:bn.find('.')]
    obj = {'netid': netid}
    vf = open(vcard, "r")
    for line in vf:
        if line.startswith("N:"):
            names = line[2:].strip().split(";")
            obj['names'] = names
        if line.startswith("TITLE:"):
            title = line[len("TITLE:"):].strip()
            set_if_truthy(obj, 'title', title)
    profs.append(obj)
"""
