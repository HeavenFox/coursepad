def conv_sub(ls):
    m = {}
    for d in ls:
        m[d['sub']] = d
    return m


class SubjectMatcher(object):
    def __init__(self):
        self.added = []
        self.deleted = []
        self.modified = []

    def match(self, previous_subjects, subjects):
        previous_subjects_by_key = conv_sub(previous_subjects)
        subjects_by_key = conv_sub(subjects)

        self.added = []
        self.deleted = []
        self.modified = []

        for key, value in subjects_by_key.iteritems():
            if key not in previous_subjects_by_key:
                self.added.append(value)
            elif previous_subjects_by_key[key] != subjects_by_key[key]:
                self.modified.append(value)

        for key in previous_subjects_by_key.iterkeys():
            if key not in subjects_by_key:
                self.deleted.append(key)
