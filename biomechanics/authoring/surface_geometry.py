"""Geometry utilities for the graphical prototype, not tissue mechanics."""
import numpy as np

def refine(vertices,faces):
 v=np.asarray(vertices);f=np.asarray(faces).reshape(-1,3)
 # Midpoint subdivision plus mild volume-preserving Taubin smoothing.
 for _ in range(2):
  edges=np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),axis=1);unique,inverse=np.unique(edges,axis=0,return_inverse=True)
  mids=(v[unique[:,0]]+v[unique[:,1]])/2;ab,bc,ca=(inverse.reshape(3,-1)+len(v));a,b,c=f.T
  f=np.vstack([np.c_[a,ab,ca],np.c_[ab,b,bc],np.c_[ca,bc,c],np.c_[ab,bc,ca]]);v=np.vstack([v,mids])
  edges=np.unique(np.sort(np.concatenate([f[:,[0,1]],f[:,[1,2]],f[:,[2,0]]]),axis=1),axis=0)
  degree=np.bincount(edges.ravel(),minlength=len(v))
  for rate in [.35,-.36]*3:
   neighbors=np.zeros_like(v);np.add.at(neighbors,edges[:,0],v[edges[:,1]]);np.add.at(neighbors,edges[:,1],v[edges[:,0]])
   v+=rate*(neighbors/degree[:,None]-v)
 return v,f

class BoneSurface:
 def __init__(self,vertices,indices,convex=False):
  self.convex=convex
  self.v=np.asarray(vertices);self.tri=self.v[np.asarray(indices).reshape(-1,3)];self.a,self.b,self.c=self.tri.transpose(1,0,2)
  self.ab=self.b-self.a;self.ac=self.c-self.a
  n=np.cross(self.ab,self.ac);self.n=n/np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-15)
  volume=np.einsum('ij,ij->i',self.a,np.cross(self.b,self.c)).sum()/6
  if volume<0:self.n*=-1
  self.lo=self.v.min(0);self.hi=self.v.max(0)
 def closest(self,points):
  result=[];normals=[];inside=[]
  ray=np.array([.721,.431,.541]);ray/=np.linalg.norm(ray)
  h=np.cross(ray,self.ac);det=np.einsum('ij,ij->i',self.ab,h);inv=np.divide(1,det,out=np.zeros_like(det),where=abs(det)>1e-10)
  aa=(self.ab*self.ab).sum(1);bb=(self.ac*self.ac).sum(1);ab=(self.ab*self.ac).sum(1);den=aa*bb-ab*ab
  for start in range(0,len(points),100):
   p=points[start:start+100];pa=p[:,None,:]-self.a[None,:,:]
   u=np.einsum('ntj,tj->nt',pa,h)*inv
   q=np.cross(pa,self.ab[None,:,:]);v=np.einsum('ntj,j->nt',q,ray)*inv;dist=np.einsum('ntj,tj->nt',q,self.ac)*inv
   hit=(abs(det)>1e-10)&(u>0)&(v>0)&(u+v<1)&(dist>1e-8)
   inside.extend(((np.einsum('ntj,tj->nt',pa,self.n)<=1e-10).all(1) if self.convex else hit.sum(1)%2==1).tolist())
   d=np.einsum('ntj,tj->nt',pa,self.n);projection=p[:,None,:]-d[:,:,None]*self.n[None,:,:]
   dot1=np.einsum('ntj,tj->nt',pa,self.ab);dot2=np.einsum('ntj,tj->nt',pa,self.ac)
   bary1=np.divide(bb*dot1-ab*dot2,den,out=np.zeros_like(dot1),where=den>1e-20);bary2=np.divide(aa*dot2-ab*dot1,den,out=np.zeros_like(dot2),where=den>1e-20)
   valid=(bary1>=0)&(bary2>=0)&(bary1+bary2<=1)&(den>1e-20)
   candidates=[projection];scores=[np.where(valid,d*d,np.inf)]
   for a,b in [(self.a,self.b),(self.b,self.c),(self.c,self.a)]:
    edge=b-a;fraction=np.clip(np.einsum('ntj,tj->nt',p[:,None,:]-a,edge)/np.maximum((edge*edge).sum(1),1e-20),0,1)
    cp=a[None,:,:]+fraction[:,:,None]*edge[None,:,:];candidates.append(cp);scores.append(((p[:,None,:]-cp)**2).sum(2))
   scores=np.stack(scores,axis=2);best=scores.reshape(len(p),-1).argmin(1);face=best//4;kind=best%4;cs=np.stack(candidates,axis=2)
   result.extend(cs[np.arange(len(p)),face,kind]);normals.extend(self.n[face])
  return np.array(result),np.array(normals),np.array(inside)
 def clear(self,points,margin=.0015):
  active=np.where(((points>=self.lo-margin)&(points<=self.hi+margin)).all(1))[0]
  if not len(active):return points,0
  p=points[active];q,n,inside=self.closest(p);distance=np.linalg.norm(q-p,axis=1);move=inside|(distance<margin)
  direction=np.where(inside[:,None],q-p,p-q)
  direction=np.divide(direction,distance[:,None],out=n.copy(),where=distance[:,None]>1e-10)
  out=points.copy();out[active[move]]=q[move]+direction[move]*margin
  return out,int(inside.sum())

def signed_volume(v,indices):
 tri=np.asarray(v)[np.asarray(indices).reshape(-1,3)];return np.einsum('ij,ij->i',tri[:,0],np.cross(tri[:,1],tri[:,2])).sum()/6
