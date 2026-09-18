"""Author a limited deltoid surface demonstration from the atlas + native paths.

Surface registration/deformation are graphical approximations. Native muscle
lengths are exported separately and never calculated from the surface.
"""
from pathlib import Path
import sys,json,math,hashlib
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from engine import ModelEngine
from surface_geometry import refine, BoneSurface, signed_volume
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'.playwright/deltoid/rejected'
OUT.mkdir(parents=True, exist_ok=True)
source=json.loads((ROOT/'public/models/deltoid/atlas.json').read_text())
e=ModelEngine('shoulder');config=e.config();base=e.baseline
R0=np.array([[0,0,1],[0,1,0],[-1,0,0]])

def points(mesh):return np.array(mesh['positions']).reshape(-1,3)
def native(mesh,p=base):
 t=np.array(p['transforms'][mesh['frame']]);return np.array(mesh['vertices'])@t[:,:3].T+t[:,3]
def nearest(a,b):
 d=((a[:,None,:]-b[None,:,:])**2).sum(2);i=d.argmin(1);return b[i],np.sqrt(d[np.arange(len(a)),i])
def similarity(a,b,scale=True):
 ac=a.mean(0);bc=b.mean(0);u,s,vt=np.linalg.svd((a-ac).T@(b-bc));r=vt.T@u.T
 if np.linalg.det(r)<0:vt[-1]*=-1;r=vt.T@u.T
 k=s.sum()/((a-ac)**2).sum() if scale else 1
 return k*r,bc-k*r@ac
bones={n:next(m for m in source['meshes'] if m['name']==n.title()) for n in ['humerus','scapula','clavicle']}
target={n:next(m for m in config['meshes'] if m['name']==n+'.vtp') for n in bones}
# Start with an anatomical-axis rotation and whole-arm scale, then use only
# corresponding named bones for nearest-surface registration (never left/right).
a=points(bones['humerus'])@R0.T;b=native(target['humerus'])
k=np.linalg.norm(np.ptp(b,axis=0))/np.linalg.norm(np.ptp(a,axis=0))
A=k*R0;t=b.mean(0)-a.mean(0)*k
for iteration in range(35):
 src=[];dst=[]
 for n in bones:
  v=points(bones[n]);v=v[::max(1,len(v)//250)];q,_=nearest(v@A.T+t,native(target[n]));src.extend(v);dst.extend(q)
 A,t=similarity(np.array(src),np.array(dst))
print('global scale',np.linalg.det(A)**(1/3))
transforms={};registration={}
for n in bones:
 v=points(bones[n]);B=A.copy();u=t.copy();dest=native(target[n])
 for iteration in range(45):
  q,_=nearest(v@B.T+u,dest);B,u=similarity(v,q)
 transforms[n]=(B,u);_,d=nearest(v@B.T+u,dest)
 registration[n]={'rmsClosestVertexMm':float(np.sqrt((d*d).mean())*1000),'scale':float(np.linalg.det(B)**(1/3))}
print('bone registrations',registration)
# Export an initial correspondence-based rest fit for visual inspection.
parts=[]
ids=['DeltoideusClavicle_A','DeltoideusScapula_M','DeltoideusScapula_P']
names=['Clavicular Part Of Deltoid Muscle','Acromial Part Of Deltoid Muscle','Scapular Spinal Part Of Deltoid Muscle']
for id,name in zip(ids,names):
 mesh=next(m for m in source['meshes'] if m['name']==name);v,faces=refine(points(mesh),mesh['indices'])
 distances=np.array([nearest(v,points(bones[n]))[1] for n in bones]).T
 weights=1/np.maximum(distances,.004)**3;weights/=weights.sum(1)[:,None]
 fitted=np.zeros_like(v)
 for i,n in enumerate(bones):
  B,u=transforms[n];fitted+=(v@B.T+u)*weights[:,i,None]
 parts.append(dict(id=id,name=name,vertices=fitted.tolist(),indices=faces.ravel().tolist(),atlasVertices=v.tolist()))
(OUT/'fit.json').write_text(json.dumps(dict(config=config,parts=parts,registration=registration),separators=(',',':')))

# Match the longitudinal endpoints of each atlas part to the corresponding
# native compartment. Preserve transverse shape instead of inventing a capsule.
def rotation_between(a,b):
 a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);v=np.cross(a,b);c=np.dot(a,b)
 K=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]])
 return np.eye(3)+K+K@K/(1+c)
def resample(path,count=101):
 path=np.array(path);d=np.r_[0,np.cumsum(np.linalg.norm(np.diff(path,axis=0),axis=1))];q=np.linspace(0,d[-1],count)
 return np.array([np.interp(q,d,path[:,j]) for j in range(3)]).T

guides={m['id']:m for m in base['muscles'] if m['id'] in ids}
# Fit every region with a shared smooth field so neighboring atlas regions
# remain neighboring surfaces, rather than stretching three separate pieces.
def warp(v,source,target):
 source=np.array(source);target=np.array(target);poly=np.c_[np.ones(len(source)),source]
 K=np.linalg.norm(source[:,None,:]-source[None,:,:],axis=2)
 system=np.block([[K+np.eye(len(source))*1e-8,poly],[poly.T,np.zeros((4,4))]])
 weights=np.linalg.lstsq(system,np.vstack([target-source,np.zeros((4,3))]),rcond=1e-10)[0]
 d=np.linalg.norm(v[:,None,:]-source[None,:,:],axis=2)
 return v+np.c_[d,np.ones(len(v)),v]@weights
src=[];dst=[]
for part in parts:
 v=np.array(part['vertices']);atlas=np.array(part['atlasVertices']);guide=guides[part['id']]
 p0=np.array(guide['path'][0]);p1=np.array(guide['path'][-1])
 tip=np.where(atlas[:,1]<=np.quantile(atlas[:,1],.01))[0]
 oi=np.linalg.norm(v-p0,axis=1).argmin();ii=tip[np.linalg.norm(v[tip]-v[tip].mean(0),axis=1).argmin()]
 part['originIndex']=int(oi);part['insertionIndices']=[int(ii)]
 src.extend([v[oi],v[ii]]);dst.extend([p0,p1])
for part in parts:part['vertices']=warp(np.array(part['vertices']),src,dst).tolist()
(OUT/'fit.json').write_text(json.dumps(dict(config=config,parts=parts,registration=registration),separators=(',',':')))

# One audited movement family, keeping scapular position and axial/plane angles
# explicit. No surface output is extrapolated to arbitrary X/Y/Z combinations.
frames=[]
hulls=json.loads((Path(__file__).parent/'bone-hulls.json').read_text())
colliders={n:BoneSurface(hulls[n+'.vtp']['vertices'],hulls[n+'.vtp']['indices'],convex=True) for n in bones}
for angle in [20,44,70]:
 pose=e.evaluate({'coordinates':{'shoulder_elv':angle}});surfaces=[]
 H0=np.array(base['transforms']['/bodyset/humerus'])[:,:3];H=np.array(pose['transforms']['/bodyset/humerus'])[:,:3];rh=H@H0.T
 # Humeral rotation is under 60 degrees here. Polar decomposition provides the
 # local proper rotation for each path location (no linear-blend collapse).
 sourceCage=[];targetCage=[]
 for part in parts:
  old=resample(guides[part['id']]['path'],9);m=next(m for m in pose['muscles'] if m['id']==part['id']);new=resample(m['path'],9)
  sourceCage.extend(old);targetCage.extend(new)
 for part in parts:
  v=warp(np.array(part['vertices']),sourceCage,targetCage)
  for iteration in range(3):
   for n,collider in colliders.items():
    t=np.array(pose['transforms'][target[n]['frame']]);local=(v-t[:,3])@t[:,:3]
    local,_=collider.clear(local)
    v=local@t[:,:3].T+t[:,3]
  surfaces.append(np.round(v,6).tolist())
 # Preserve the total reference surface volume with one shared, smooth radial
 # field. This is a graphical volume constraint, not a force/strain simulation.
 initialVolume=sum(abs(signed_volume(v,p['indices'])) for v,p in zip(surfaces,parts))
 if not frames:targetVolume=initialVolume
 hum=np.array(pose['transforms']['/bodyset/humerus']);origin=hum[:,3];axis=-hum[:,1]
 end=np.mean([next(m for m in pose['muscles'] if m['id']==p['id'])['path'][-1] for p in parts],axis=0)
 span=np.dot(end-origin,axis)
 def expand(amount):
  output=[]
  for v in surfaces:
   v=np.array(v);long=(v-origin)@axis;t=np.clip(long/span,0,1)
   radial=v-(origin+long[:,None]*axis)
   output.append(v+radial*(amount*np.sin(np.pi*t)**2)[:,None])
  return output
 low,high=0.,2.
 for _ in range(30):
  amount=(low+high)/2;candidate=expand(amount);volume=sum(abs(signed_volume(v,p['indices'])) for v,p in zip(candidate,parts))
  if volume<targetVolume:low=amount
  else:high=amount
 corrected=expand((low+high)/2)
 frames.append(dict(angle=angle,pose=pose,surfaces=[np.round(v,6).tolist() for v in corrected],volumeScale=(low+high)/2))
asset=dict(schema=1,modelVersion=config['version'],config=config,parts=parts,frames=frames,registration=registration,license='CC BY-SA 4.0',scope='Deltoid surface illustration; 20–70 degrees glenohumeral elevation, fixed model scapula and axial rotation. Not simulated muscle tissue.')
(OUT/'trial.json').write_text(json.dumps(asset,separators=(',',':')))
print('wrote',len(frames),'frames')
