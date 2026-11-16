with open('src/screens.js', 'rb') as f:
    d = f.read()

i = d.find(b'<<<<<<< HEAD')
j = d.find(b'=======', i)
k = d.find(b'>>>>>>>', j)
print(repr(d[i:k+60]))
