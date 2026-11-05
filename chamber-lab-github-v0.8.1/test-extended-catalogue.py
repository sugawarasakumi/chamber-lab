#!/usr/bin/env python3
"""Build/check the additional CEL examples using exact quotient fields only.

Default: independently recompute projective intersection multiplicities and
Euler/simpliciality checks from data/extended-catalogue.json.
Optional: --build-from PATH_TO_CEL_DATABASE_PY regenerates the data by parsing
the primary authors' assignments with Python's AST (no Sage execution).
"""
import argparse
import ast
from collections import Counter
from fractions import Fraction as F
from hashlib import sha256
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'data/extended-catalogue.json'
SOURCE_COMMIT = '4620e43b0db7cbc4eafaa610d9b2c3dd211e5426'
SOURCE_HASH = 'c2cb7439b9c43b5a49676235138a6fb1c08fdfc3619703bb2680a3e130c534aa'
SOURCE_URL = f'https://github.com/sophiasage/cn_hyperarr/blob/{SOURCE_COMMIT}/cn_hyperarr/database.py'
PUBLICATION_URL = 'https://d-nb.info/1250074576/34'

# Every nonrational field needed by the missing CEL entries through 21 lines.
# Coefficients are ascending. Intervals isolate the published real embedding.
FIELDS = {
    'tau': {'label': 'Q(τ), τ=(1+√5)/2', 'polynomial': ['-1','-1','1'], 'interval': ['1618/1000','1619/1000']},
    'sqrt2': {'label': 'Q(√2)', 'polynomial': ['-2','0','1'], 'interval': ['1414/1000','1415/1000']},
    'r7': {'label': 'Q(2cos(2π/7))', 'polynomial': ['-1','-2','1','1'], 'interval': ['1246/1000','1247/1000']},
    'r9': {'label': 'Q(2cos(2π/9))', 'polynomial': ['1','-3','0','1'], 'interval': ['1532/1000','1533/1000']},
    'rho': {'label': 'Q(ρ), ρ³−3ρ−25=0', 'polynomial': ['-25','-3','0','1'], 'interval': ['3264/1000','3265/1000']},
}


class Field:
    def __init__(self, polynomial):
        self.polynomial = tuple(map(F, polynomial))
        assert self.polynomial[-1] == 1
        self.degree = len(self.polynomial)-1

    def number(self, values=0):
        if isinstance(values, Number):
            assert values.field is self
            return values
        if not isinstance(values, (list,tuple)):
            values = [values]
        values = list(map(F,values))
        for i in range(len(values)-1,self.degree-1,-1):
            for j in range(self.degree):
                values[i-self.degree+j] -= values[i]*self.polynomial[j]
        return Number(self,tuple((values+[F(0)]*self.degree)[:self.degree]))

    def expression(self, text, symbol=None):
        return parse_expression(ast.parse(str(text).replace('^','**'),mode='eval').body,self,symbol)


class Number:
    def __init__(self, field, coefficients):
        self.field,self.coefficients = field,coefficients

    def __add__(self, other):
        other=self.field.number(other)
        return self.field.number([a+b for a,b in zip(self.coefficients,other.coefficients)])
    __radd__=__add__

    def __neg__(self):
        return self.field.number([-a for a in self.coefficients])

    def __sub__(self, other):
        return self+-self.field.number(other)

    def __mul__(self, other):
        other=self.field.number(other)
        product=[F(0)]*(2*self.field.degree-1)
        for i,a in enumerate(self.coefficients):
            for j,b in enumerate(other.coefficients):
                product[i+j]+=a*b
        return self.field.number(product)
    __rmul__=__mul__

    def inverse(self):
        assert self, 'division by zero'
        d=self.field.degree
        columns=[(self*self.field.number([0]*i+[1])).coefficients for i in range(d)]
        matrix=[[columns[j][i] for j in range(d)]+[F(i==0)] for i in range(d)]
        for col in range(d):
            pivot=next(i for i in range(col,d) if matrix[i][col])
            matrix[col],matrix[pivot]=matrix[pivot],matrix[col]
            scale=matrix[col][col]
            matrix[col]=[x/scale for x in matrix[col]]
            for i in range(d):
                if i!=col:
                    scale=matrix[i][col]
                    matrix[i]=[a-scale*b for a,b in zip(matrix[i],matrix[col])]
        return self.field.number([row[-1] for row in matrix])

    def __truediv__(self, other):
        return self*self.field.number(other).inverse()

    def __pow__(self, exponent):
        assert isinstance(exponent,int) and exponent>=0
        result=self.field.number(1)
        for _ in range(exponent): result=result*self
        return result

    def __bool__(self): return any(self.coefficients)
    def __eq__(self, other):
        return self.coefficients==self.field.number(other).coefficients
    def __hash__(self): return hash(self.coefficients)


def parse_expression(node, field, symbol):
    if isinstance(node,ast.Constant) and isinstance(node.value,int):
        return field.number(node.value)
    if isinstance(node,ast.Name) and node.id==symbol:
        return field.number([0,1])
    if isinstance(node,ast.Call) and isinstance(node.func,ast.Name) and node.func.id=='QQ' and len(node.args)==1:
        return parse_expression(node.args[0],field,symbol)
    if isinstance(node,ast.UnaryOp):
        value=parse_expression(node.operand,field,symbol)
        if isinstance(node.op,ast.USub): return -value
        if isinstance(node.op,ast.UAdd): return value
    if isinstance(node,ast.BinOp):
        left=parse_expression(node.left,field,symbol)
        if isinstance(node.op,ast.Pow): return left**ast.literal_eval(node.right)
        right=parse_expression(node.right,field,symbol)
        if isinstance(node.op,ast.Add): return left+right
        if isinstance(node.op,ast.Sub): return left-right
        if isinstance(node.op,ast.Mult): return left*right
        if isinstance(node.op,ast.Div): return left/right
    raise ValueError('Unsupported exact expression: '+ast.unparse(node))


def format_number(value, symbol):
    terms=[]
    for power,coefficient in enumerate(value.coefficients):
        if not coefficient: continue
        negative=coefficient<0
        coefficient=abs(coefficient)
        variable='' if power==0 else symbol if power==1 else f'{symbol}^{power}'
        term=str(coefficient) if power==0 else variable if coefficient==1 else f'{coefficient}*{variable}'
        terms.append(('-' if negative else '',term))
    if not terms: return '0'
    return ''.join((('-' if negative else '') if i==0 else (' - ' if negative else ' + '))+term
                   for i,(negative,term) in enumerate(terms))


def assignments(source, dictionary):
    result={}
    for node in ast.parse(source).body:
        if not isinstance(node,ast.Assign) or not isinstance(node.targets[0],ast.Subscript): continue
        target=node.targets[0]
        if isinstance(target.value,ast.Name) and target.value.id==dictionary:
            result[ast.literal_eval(target.slice)]=node.value
    return result


def build(source_path):
    source_bytes=Path(source_path).read_bytes()
    assert sha256(source_bytes).hexdigest()==SOURCE_HASH, 'Source differs from the pinned published-author database.'
    source=source_bytes.decode('utf8')
    normals=assignments(source,'db_normals_CEL')
    invariants={key:ast.literal_eval(value) for key,value in assignments(source,'db_invariants_CEL').items()}
    existing={tuple(entry['celKey']) for entry in json.loads((ROOT/'data/catalogue-projective-normals.json').read_text())}
    existing|={(6,24,1),(7,32,1),(9,48,1)}
    entries=[]
    for key,node in normals.items():
        if key[0]>21 or key in existing: continue
        invariant=invariants[key]
        label=invariant[0]
        names={x.id for x in ast.walk(node) if isinstance(x,ast.Name) and x.id!='QQ'}
        assert len(names)<=1
        name=next(iter(names),None)
        symbol=f'u{label[0]}_{label[1]}' if name else None
        descriptor={**FIELDS[name],'id':symbol,'symbol':symbol,'sourceGenerator':name,'degree':len(FIELDS[name]['polynomial'])-1} if name else None
        field=Field(descriptor['polynomial'] if descriptor else ['0','1'])
        exact=[[parse_expression(coordinate,field,name) for coordinate in row.elts] for row in node.elts]
        if any(row==[field.number(0),field.number(0),field.number(1)] for row in exact):
            permutation=[0,1,2]
        else:
            permutation=[0,2,1]
        exact=[[row[i] for i in permutation] for row in exact]
        decone=next(i for i,row in enumerate(exact) if row==[field.number(0),field.number(0),field.number(1)])
        entries.append({
            'id':'cel-'+'-'.join(map(str,key)),
            'name':f'Grünbaum A({label[0]},{label[1]})',
            'grunbaumLabel':list(label),'celKey':list(key),'field':descriptor,
            'projectiveNormals':[[format_number(x,symbol) for x in row] for row in exact],
            'coordinatePermutation':permutation,'deconeIndex':decone,
            'source':PUBLICATION_URL,'dataSource':SOURCE_URL,'sourceSha256':SOURCE_HASH,
            'sourceTable':'CEL Appendix A; labels and invariants from Table 5',
            'expected':{'t':{str(i+2):count for i,count in enumerate(invariant[2]) if count},
                        'regions':key[1],'projectiveFVector':list(invariant[1]),
                        'characteristicRoots':list(invariant[6])}
        })
    return entries


def polynomial_trim(p):
    while p and not p[-1]: p.pop()
    return p


def polynomial_remainder(a,b):
    a=a[:]
    while len(a)>=len(b):
        scale=a[-1]/b[-1];offset=len(a)-len(b)
        for i,x in enumerate(b):a[offset+i]-=scale*x
        polynomial_trim(a)
    return a


def polynomial_value(p,x):
    result=F(0)
    for coefficient in reversed(p):result=result*x+coefficient
    return result


def validate_embedding(descriptor):
    polynomial=list(map(F,descriptor['polynomial']))
    lo,hi=map(F,descriptor['interval']);assert lo<hi
    chain=[polynomial,[i*x for i,x in enumerate(polynomial)][1:]]
    while chain[-1]:
        remainder=[-x for x in polynomial_remainder(chain[-2],chain[-1])]
        if not remainder:break
        chain.append(remainder)
    def variations(x):
        values=[polynomial_value(p,x) for p in chain]
        signs=[1 if v>0 else -1 for v in values if v]
        return sum(a!=b for a,b in zip(signs,signs[1:]))
    assert polynomial_value(polynomial,lo) and polynomial_value(polynomial,hi)
    assert variations(lo)-variations(hi)==1,'interval isolates exactly one real root'


def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


def projective_key(vector):
    scale=next((x for x in vector if x),None)
    assert scale is not None,'zero normal or coincident projective lines'
    inverse=scale.inverse()
    return tuple(x*inverse for x in vector)


def validate(entries):
    assert len(entries)>=10
    assert len({entry['id'] for entry in entries})==len(entries)
    fields=Counter()
    for entry in entries:
        descriptor=entry['field']
        if descriptor:validate_embedding(descriptor)
        fields[descriptor['sourceGenerator'] if descriptor else 'Q']+=1
        field=Field(descriptor['polynomial'] if descriptor else ['0','1'])
        symbol=descriptor['symbol'] if descriptor else None
        normals=[[field.expression(x,symbol) for x in row] for row in entry['projectiveNormals']]
        assert len(normals)==entry['celKey'][0]<=21
        assert len({projective_key(row) for row in normals})==len(normals),'distinct lines'
        assert normals[entry['deconeIndex']]==[field.number(0),field.number(0),field.number(1)]
        points={}
        for i,a in enumerate(normals):
            for b in normals[i+1:]:
                point=projective_key(cross(a,b))
                points.setdefault(point,sum(not sum((x*y for x,y in zip(normal,point)),field.number(0)) for normal in normals))
        multiplicities=Counter(points.values())
        expected={int(m):count for m,count in entry['expected']['t'].items()}
        assert multiplicities==expected,(entry['name'],multiplicities,expected)
        n=len(normals)
        assert sum(m*(m-1)//2*count for m,count in multiplicities.items())==n*(n-1)//2
        vertices=sum(multiplicities.values())
        edges=sum(m*count for m,count in multiplicities.items())
        regions=1+sum((m-1)*count for m,count in multiplicities.items())
        assert [vertices,edges,regions]==entry['expected']['projectiveFVector']
        assert 2*regions==entry['expected']['regions']
        assert vertices-edges+regions==1,'RP2 Euler relation'
        assert 3*regions==2*edges,'simpliciality equality'
        roots=entry['expected']['characteristicRoots']
        if roots:
            assert sum(roots)==n
            assert sum(roots[i]*roots[j] for i in range(3) for j in range(i+1,3))==edges-vertices
        print(entry['name'],entry['celKey'],'field='+str(descriptor['sourceGenerator'] if descriptor else 'Q'),'t='+str(dict(sorted(multiplicities.items()))))
    print(f'extended catalogue: {len(entries)} exact realizations passed; fields={dict(fields)}')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build-from',metavar='CEL_DATABASE_PY')
    args=parser.parse_args()
    if args.build_from:
        entries=build(args.build_from)
        DATA.write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
    else:
        entries=json.loads(DATA.read_text())
    validate(entries)
