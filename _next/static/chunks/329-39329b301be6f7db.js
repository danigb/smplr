(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[329],{3454:function(e,n,t){"use strict";var r,m;e.exports=(null==(r=t.g.process)?void 0:r.env)&&"object"==typeof(null==(m=t.g.process)?void 0:m.env)?t.g.process:t(7663)},4791:function(e){e.exports={style:{fontFamily:"'__Inter_58ac55', '__Inter_Fallback_58ac55'",fontStyle:"normal"},className:"__className_58ac55"}},7663:function(e){!function(){var n={229:function(e){var n,t,r,m=e.exports={};function i(){throw Error("setTimeout has not been defined")}function a(){throw Error("clearTimeout has not been defined")}function o(e){if(n===setTimeout)return setTimeout(e,0);if((n===i||!n)&&setTimeout)return n=setTimeout,setTimeout(e,0);try{return n(e,0)}catch(t){try{return n.call(null,e,0)}catch(t){return n.call(this,e,0)}}}!function(){try{n="function"==typeof setTimeout?setTimeout:i}catch(e){n=i}try{t="function"==typeof clearTimeout?clearTimeout:a}catch(e){t=a}}();var l=[],s=!1,P=-1;function u(){s&&r&&(s=!1,r.length?l=r.concat(l):P=-1,l.length&&M())}function M(){if(!s){var e=o(u);s=!0;for(var n=l.length;n;){for(r=l,l=[];++P<n;)r&&r[P].run();P=-1,n=l.length}r=null,s=!1,function(e){if(t===clearTimeout)return clearTimeout(e);if((t===a||!t)&&clearTimeout)return t=clearTimeout,clearTimeout(e);try{t(e)}catch(n){try{return t.call(null,e)}catch(n){return t.call(this,e)}}}(e)}}function c(e,n){this.fun=e,this.array=n}function d(){}m.nextTick=function(e){var n=Array(arguments.length-1);if(arguments.length>1)for(var t=1;t<arguments.length;t++)n[t-1]=arguments[t];l.push(new c(e,n)),1!==l.length||s||o(M)},c.prototype.run=function(){this.fun.apply(null,this.array)},m.title="browser",m.browser=!0,m.env={},m.argv=[],m.version="",m.versions={},m.on=d,m.addListener=d,m.once=d,m.off=d,m.removeListener=d,m.removeAllListeners=d,m.emit=d,m.prependListener=d,m.prependOnceListener=d,m.listeners=function(e){return[]},m.binding=function(e){throw Error("process.binding is not supported")},m.cwd=function(){return"/"},m.chdir=function(e){throw Error("process.chdir is not supported")},m.umask=function(){return 0}}},t={};function r(e){var m=t[e];if(void 0!==m)return m.exports;var i=t[e]={exports:{}},a=!0;try{n[e](i,i.exports,r),a=!1}finally{a&&delete t[e]}return i.exports}r.ab="//";var m=r(229);e.exports=m}()},9008:function(e,n,t){e.exports=t(6665)},7699:function(e,n,t){"use strict";function r(e){return null!==e&&"object"==typeof e&&"name"in e&&"string"==typeof e.name}function m(e){return null!==e&&"object"==typeof e&&"step"in e&&"number"==typeof e.step&&"alt"in e&&"number"==typeof e.alt&&!isNaN(e.step)&&!isNaN(e.alt)}t.d(n,{jC:function(){return eD},e6:function(){return eR},Ci:function(){return eY}});var i=[0,2,4,-1,1,3,5],a=i.map(e=>Math.floor(7*e/12));function o(e){let{step:n,alt:t,oct:r,dir:m=1}=e,o=i[n]+7*t;return void 0===r?[m*o]:[m*o,m*(r-a[n]-4*t)]}var l=[3,0,4,1,5,2,6];function s(e){let[n,t,r]=e,m=l[function(e){let n=(e+1)%7;return n<0?7+n:n}(n)],i=Math.floor((n+1)/7);if(void 0===t)return{step:m,alt:i,dir:r};let o=t+4*i+a[m];return{step:m,alt:i,oct:o,dir:r}}var P=(e,n)=>Array(Math.abs(n)+1).join(e),u=Object.freeze({empty:!0,name:"",num:NaN,q:"",type:"",step:NaN,alt:NaN,dir:NaN,simple:NaN,semitones:NaN,chroma:NaN,coord:[],oct:NaN}),M=RegExp("^([-+]?\\d+)(d{1,4}|m|M|P|A{1,4})|(AA|A|P|M|m|d|dd)([-+]?\\d+)$"),c={};function d(e){return"string"==typeof e?c[e]||(c[e]=function(e){let n=function(e){let n=M.exec(`${e}`);return null===n?["",""]:n[1]?[n[1],n[2]]:[n[4],n[3]]}(e);if(""===n[0])return u;let t=+n[0],r=n[1],m=(Math.abs(t)-1)%7,i=p[m];if("M"===i&&"P"===r)return u;let a="M"===i?"majorable":"perfectable",l=""+t+r,s=t<0?-1:1,P=8===t||-8===t?t:s*(m+1),c="M"===r&&"majorable"===a||"P"===r&&"perfectable"===a?0:"m"===r&&"majorable"===a?-1:/^A+$/.test(r)?r.length:/^d+$/.test(r)?-1*("perfectable"===a?r.length:r.length+1):0,d=Math.floor((Math.abs(t)-1)/7),f=s*(h[m]+c+12*d),b=(s*(h[m]+c)%12+12)%12,y=o({step:m,alt:c,oct:d,dir:s});return{empty:!1,name:l,num:t,q:r,step:m,alt:c,dir:s,type:a,simple:P,semitones:f,chroma:b,coord:y,oct:d}}(e)):m(e)?d(function(e){let{step:n,alt:t,oct:r=0,dir:m}=e;if(!m)return"";let i=n+1+7*r,a="M"===p[n]?"majorable":"perfectable";return(m<0?"-":"")+(0===i?n+1:i)+(0===t?"majorable"===a?"M":"P":-1===t&&"majorable"===a?"m":t>0?P("A",t):P("d","perfectable"===a?t:t+1))}(e)):r(e)?d(e.name):u}var h=[0,2,4,5,7,9,11],p="PMMPPMM";function f(e,n){let[t,r=0]=e;return d(s(n||7*t+12*r<0?[-t,-r,-1]:[t,r,1]))}var b=(e,n)=>Array(Math.abs(n)+1).join(e),y=Object.freeze({empty:!0,name:"",letter:"",acc:"",pc:"",step:NaN,alt:NaN,chroma:NaN,height:NaN,coord:[],midi:null,freq:null}),A=new Map,g=e=>"CDEFGAB".charAt(e),v=e=>e<0?b("b",-e):b("#",e),j=e=>"b"===e[0]?-e.length:e.length;function N(e){let n=JSON.stringify(e),t=A.get(n);if(t)return t;let i="string"==typeof e?function(e){let n=x(e);if(""===n[0]||""!==n[3])return y;let t=n[0],r=n[1],m=n[2],i=(t.charCodeAt(0)+3)%7,a=j(r),l=m.length?+m:void 0,s=o({step:i,alt:a,oct:l}),P=t+r+m,u=t+r,M=(w[i]+a+120)%12,c=void 0===l?T(w[i]+a,12)-1188:w[i]+a+12*(l+1);return{empty:!1,acc:r,alt:a,chroma:M,coord:s,freq:void 0===l?null:440*Math.pow(2,(c-69)/12),height:c,letter:t,midi:c>=0&&c<=127?c:null,name:P,oct:l,pc:u,step:i}}(e):m(e)?N(function(e){let{step:n,alt:t,oct:r}=e,m=g(n);if(!m)return"";let i=m+v(t);return r||0===r?i+r:i}(e)):r(e)?N(e.name):y;return A.set(n,i),i}var I=/^([a-gA-G]?)(#{1,}|b{1,}|x{1,}|)(-?\d*)\s*(.*)$/;function x(e){let n=I.exec(e);return n?[n[1].toUpperCase(),n[2].replace(/x/g,"##"),n[3],n[4]]:["","","",""]}var T=(e,n)=>(e%n+n)%n,w=[0,2,4,5,7,9,11];function D(e,n){let t=N(e),r=Array.isArray(n)?n:d(n).coord;if(t.empty||!r||r.length<2)return"";let m=t.coord;return N(s(1===m.length?[m[0]+r[0]]:[m[0]+r[0],m[1]+r[1]])).name}function S(e,n){let t=e.length;return r=>{if(!n)return"";let m=D(n,[0,Math.floor(r/t)]);return D(m,e[r<0?(t- -r%t)%t:r%t])}}function C(e,n){let t=N(e),r=N(n);if(t.empty||r.empty)return"";let m=t.coord,i=r.coord,a=i[0]-m[0],o=2===m.length&&2===i.length?i[1]-m[1]:-Math.floor(7*a/12);return f([a,o],r.height===t.height&&null!==r.midi&&null!==t.midi&&t.step>r.step).name}function V(e,n,t){return function(...r){return console.warn(`${e} is deprecated. Use ${n}.`),t.apply(this,r)}}var E=V("isNamed","isNamedPitch",r);function $(e,n){return e<n?function(e,n){let t=[];for(;n--;t[n]=n+e);return t}(e,n-e+1):function(e,n){let t=[];for(;n--;t[n]=e-n);return t}(e,e-n+1)}function k(e,n){let t=n.length,r=(e%t+t)%t;return n.slice(r,t).concat(n.slice(0,r))}function F(e){return e.filter(e=>0===e||e)}var q={empty:!0,name:"",setNum:0,chroma:"000000000000",normalized:"000000000000",intervals:[]},O=e=>Number(e).toString(2).padStart(12,"0"),_=e=>parseInt(e,2),z=/^[01]{12}$/;function G(e){return z.test(e)}var L=e=>"number"==typeof e&&e>=0&&e<=4095,B=e=>e&&G(e.chroma),U={[q.chroma]:q};function R(e){let n=G(e)?e:L(e)?O(e):Array.isArray(e)?function(e){let n;if(0===e.length)return q.chroma;let t=[0,0,0,0,0,0,0,0,0,0,0,0];for(let r=0;r<e.length;r++)(n=N(e[r])).empty&&(n=d(e[r])),n.empty||(t[n.chroma]=1);return t.join("")}(e):B(e)?e.chroma:q.chroma;return U[n]=U[n]||function(e){let n=_(e),t=O((function(e){let n=e.split("");return n.map((e,t)=>k(t,n).join(""))})(e).map(_).filter(e=>e>=2048).sort()[0]),r=function(e){let n=[];for(let t=0;t<12;t++)"1"===e.charAt(t)&&n.push(J[t]);return n}(e);return{empty:!1,name:"",setNum:n,chroma:e,normalized:t,intervals:r}}(n)}V("Pcset.pcset","Pcset.get",R);var H=e=>R(e).chroma,J=["1P","2m","2M","3m","3M","4P","5d","5P","6m","6M","7m","7M"];function K(e){let n=R(e).setNum;return e=>{let t=R(e).setNum;return n&&n!==t&&(t&n)===t}}var Q={...q,name:"",quality:"Unknown",intervals:[],aliases:[]},W=[],X={};function Y(e){return X[e]||Q}function Z(){return W.slice()}V("ChordType.chordType","ChordType.get",Y),V("ChordType.entries","ChordType.all",Z),[["1P 3M 5P","major","M ^  maj"],["1P 3M 5P 7M","major seventh","maj7 Δ ma7 M7 Maj7 ^7"],["1P 3M 5P 7M 9M","major ninth","maj9 Δ9 ^9"],["1P 3M 5P 7M 9M 13M","major thirteenth","maj13 Maj13 ^13"],["1P 3M 5P 6M","sixth","6 add6 add13 M6"],["1P 3M 5P 6M 9M","sixth added ninth","6add9 6/9 69 M69"],["1P 3M 6m 7M","major seventh flat sixth","M7b6 ^7b6"],["1P 3M 5P 7M 11A","major seventh sharp eleventh","maj#4 Δ#4 Δ#11 M7#11 ^7#11 maj7#11"],["1P 3m 5P","minor","m min -"],["1P 3m 5P 7m","minor seventh","m7 min7 mi7 -7"],["1P 3m 5P 7M","minor/major seventh","m/ma7 m/maj7 mM7 mMaj7 m/M7 -Δ7 mΔ -^7 -maj7"],["1P 3m 5P 6M","minor sixth","m6 -6"],["1P 3m 5P 7m 9M","minor ninth","m9 -9"],["1P 3m 5P 7M 9M","minor/major ninth","mM9 mMaj9 -^9"],["1P 3m 5P 7m 9M 11P","minor eleventh","m11 -11"],["1P 3m 5P 7m 9M 13M","minor thirteenth","m13 -13"],["1P 3m 5d","diminished","dim \xb0 o"],["1P 3m 5d 7d","diminished seventh","dim7 \xb07 o7"],["1P 3m 5d 7m","half-diminished","m7b5 \xf8 -7b5 h7 h"],["1P 3M 5P 7m","dominant seventh","7 dom"],["1P 3M 5P 7m 9M","dominant ninth","9"],["1P 3M 5P 7m 9M 13M","dominant thirteenth","13"],["1P 3M 5P 7m 11A","lydian dominant seventh","7#11 7#4"],["1P 3M 5P 7m 9m","dominant flat ninth","7b9"],["1P 3M 5P 7m 9A","dominant sharp ninth","7#9"],["1P 3M 7m 9m","altered","alt7"],["1P 4P 5P","suspended fourth","sus4 sus"],["1P 2M 5P","suspended second","sus2"],["1P 4P 5P 7m","suspended fourth seventh","7sus4 7sus"],["1P 5P 7m 9M 11P","eleventh","11"],["1P 4P 5P 7m 9m","suspended fourth flat ninth","b9sus phryg 7b9sus 7b9sus4"],["1P 5P","fifth","5"],["1P 3M 5A","augmented","aug + +5 ^#5"],["1P 3m 5A","minor augmented","m#5 -#5 m+"],["1P 3M 5A 7M","augmented seventh","maj7#5 maj7+5 +maj7 ^7#5"],["1P 3M 5P 7M 9M 11A","major sharp eleventh (lydian)","maj9#11 Δ9#11 ^9#11"],["1P 2M 4P 5P","","sus24 sus4add9"],["1P 3M 5A 7M 9M","","maj9#5 Maj9#5"],["1P 3M 5A 7m","","7#5 +7 7+ 7aug aug7"],["1P 3M 5A 7m 9A","","7#5#9 7#9#5 7alt"],["1P 3M 5A 7m 9M","","9#5 9+"],["1P 3M 5A 7m 9M 11A","","9#5#11"],["1P 3M 5A 7m 9m","","7#5b9 7b9#5"],["1P 3M 5A 7m 9m 11A","","7#5b9#11"],["1P 3M 5A 9A","","+add#9"],["1P 3M 5A 9M","","M#5add9 +add9"],["1P 3M 5P 6M 11A","","M6#11 M6b5 6#11 6b5"],["1P 3M 5P 6M 7M 9M","","M7add13"],["1P 3M 5P 6M 9M 11A","","69#11"],["1P 3m 5P 6M 9M","","m69 -69"],["1P 3M 5P 6m 7m","","7b6"],["1P 3M 5P 7M 9A 11A","","maj7#9#11"],["1P 3M 5P 7M 9M 11A 13M","","M13#11 maj13#11 M13+4 M13#4"],["1P 3M 5P 7M 9m","","M7b9"],["1P 3M 5P 7m 11A 13m","","7#11b13 7b5b13"],["1P 3M 5P 7m 13M","","7add6 67 7add13"],["1P 3M 5P 7m 9A 11A","","7#9#11 7b5#9 7#9b5"],["1P 3M 5P 7m 9A 11A 13M","","13#9#11"],["1P 3M 5P 7m 9A 11A 13m","","7#9#11b13"],["1P 3M 5P 7m 9A 13M","","13#9"],["1P 3M 5P 7m 9A 13m","","7#9b13"],["1P 3M 5P 7m 9M 11A","","9#11 9+4 9#4"],["1P 3M 5P 7m 9M 11A 13M","","13#11 13+4 13#4"],["1P 3M 5P 7m 9M 11A 13m","","9#11b13 9b5b13"],["1P 3M 5P 7m 9m 11A","","7b9#11 7b5b9 7b9b5"],["1P 3M 5P 7m 9m 11A 13M","","13b9#11"],["1P 3M 5P 7m 9m 11A 13m","","7b9b13#11 7b9#11b13 7b5b9b13"],["1P 3M 5P 7m 9m 13M","","13b9"],["1P 3M 5P 7m 9m 13m","","7b9b13"],["1P 3M 5P 7m 9m 9A","","7b9#9"],["1P 3M 5P 9M","","Madd9 2 add9 add2"],["1P 3M 5P 9m","","Maddb9"],["1P 3M 5d","","Mb5"],["1P 3M 5d 6M 7m 9M","","13b5"],["1P 3M 5d 7M","","M7b5"],["1P 3M 5d 7M 9M","","M9b5"],["1P 3M 5d 7m","","7b5"],["1P 3M 5d 7m 9M","","9b5"],["1P 3M 7m","","7no5"],["1P 3M 7m 13m","","7b13"],["1P 3M 7m 9M","","9no5"],["1P 3M 7m 9M 13M","","13no5"],["1P 3M 7m 9M 13m","","9b13"],["1P 3m 4P 5P","","madd4"],["1P 3m 5P 6m 7M","","mMaj7b6"],["1P 3m 5P 6m 7M 9M","","mMaj9b6"],["1P 3m 5P 7m 11P","","m7add11 m7add4"],["1P 3m 5P 9M","","madd9"],["1P 3m 5d 6M 7M","","o7M7"],["1P 3m 5d 7M","","oM7"],["1P 3m 6m 7M","","mb6M7"],["1P 3m 6m 7m","","m7#5"],["1P 3m 6m 7m 9M","","m9#5"],["1P 3m 5A 7m 9M 11P","","m11A"],["1P 3m 6m 9m","","mb6b9"],["1P 2M 3m 5d 7m","","m9b5"],["1P 4P 5A 7M","","M7#5sus4"],["1P 4P 5A 7M 9M","","M9#5sus4"],["1P 4P 5A 7m","","7#5sus4"],["1P 4P 5P 7M","","M7sus4"],["1P 4P 5P 7M 9M","","M9sus4"],["1P 4P 5P 7m 9M","","9sus4 9sus"],["1P 4P 5P 7m 9M 13M","","13sus4 13sus"],["1P 4P 5P 7m 9m 13m","","7sus4b9b13 7b9b13sus4"],["1P 4P 7m 10m","","4 quartal"],["1P 5P 7m 9m 11P","","11b9"]].forEach(([e,n,t])=>(function(e,n,t){let r=function(e){let n=n=>-1!==e.indexOf(n);return n("5A")?"Augmented":n("3M")?"Major":n("5d")?"Diminished":n("3m")?"Minor":"Unknown"}(e),m={...R(e),name:t||"",quality:r,intervals:e,aliases:n};W.push(m),m.name&&(X[m.name]=m),X[m.setNum]=m,X[m.chroma]=m,m.aliases.forEach(e=>{X[e]=m})})(e.split(" "),t.split(" "),n)),W.sort((e,n)=>e.setNum-n.setNum);var ee={anyThirds:384,perfectFifth:16,nonPerfectFifths:40,anySeventh:3},en=e=>n=>!!(n&e);en(ee.anyThirds),en(ee.perfectFifth),en(ee.anySeventh),en(ee.nonPerfectFifths),er((e,n)=>[e[0]+n[0],e[1]+n[1]]);var et=er((e,n)=>[e[0]-n[0],e[1]-n[1]]);function er(e){return(n,t)=>{let r=d(n).coord,m=d(t).coord;if(r&&m)return f(e(r,m)).name}}var em={...q,intervals:[],aliases:[]},ei=[],ea={};function eo(e){return ea[e]||em}function el(){return ei.slice()}V("ScaleDictionary.scaleType","ScaleType.get",eo),V("ScaleDictionary.entries","ScaleType.all",el),[["1P 2M 3M 5P 6M","major pentatonic","pentatonic"],["1P 2M 3M 4P 5P 6M 7M","major","ionian"],["1P 2M 3m 4P 5P 6m 7m","minor","aeolian"],["1P 2M 3m 3M 5P 6M","major blues"],["1P 3m 4P 5d 5P 7m","minor blues","blues"],["1P 2M 3m 4P 5P 6M 7M","melodic minor"],["1P 2M 3m 4P 5P 6m 7M","harmonic minor"],["1P 2M 3M 4P 5P 6M 7m 7M","bebop"],["1P 2M 3m 4P 5d 6m 6M 7M","diminished","whole-half diminished"],["1P 2M 3m 4P 5P 6M 7m","dorian"],["1P 2M 3M 4A 5P 6M 7M","lydian"],["1P 2M 3M 4P 5P 6M 7m","mixolydian","dominant"],["1P 2m 3m 4P 5P 6m 7m","phrygian"],["1P 2m 3m 4P 5d 6m 7m","locrian"],["1P 3M 4P 5P 7M","ionian pentatonic"],["1P 3M 4P 5P 7m","mixolydian pentatonic","indian"],["1P 2M 4P 5P 6M","ritusen"],["1P 2M 4P 5P 7m","egyptian"],["1P 3M 4P 5d 7m","neopolitan major pentatonic"],["1P 3m 4P 5P 6m","vietnamese 1"],["1P 2m 3m 5P 6m","pelog"],["1P 2m 4P 5P 6m","kumoijoshi"],["1P 2M 3m 5P 6m","hirajoshi"],["1P 2m 4P 5d 7m","iwato"],["1P 2m 4P 5P 7m","in-sen"],["1P 3M 4A 5P 7M","lydian pentatonic","chinese"],["1P 3m 4P 6m 7m","malkos raga"],["1P 3m 4P 5d 7m","locrian pentatonic","minor seven flat five pentatonic"],["1P 3m 4P 5P 7m","minor pentatonic","vietnamese 2"],["1P 3m 4P 5P 6M","minor six pentatonic"],["1P 2M 3m 5P 6M","flat three pentatonic","kumoi"],["1P 2M 3M 5P 6m","flat six pentatonic"],["1P 2m 3M 5P 6M","scriabin"],["1P 3M 5d 6m 7m","whole tone pentatonic"],["1P 3M 4A 5A 7M","lydian #5P pentatonic"],["1P 3M 4A 5P 7m","lydian dominant pentatonic"],["1P 3m 4P 5P 7M","minor #7M pentatonic"],["1P 3m 4d 5d 7m","super locrian pentatonic"],["1P 2M 3m 4P 5P 7M","minor hexatonic"],["1P 2A 3M 5P 5A 7M","augmented"],["1P 2M 4P 5P 6M 7m","piongio"],["1P 2m 3M 4A 6M 7m","prometheus neopolitan"],["1P 2M 3M 4A 6M 7m","prometheus"],["1P 2m 3M 5d 6m 7m","mystery #1"],["1P 2m 3M 4P 5A 6M","six tone symmetric"],["1P 2M 3M 4A 5A 6A","whole tone","messiaen's mode #1"],["1P 2m 4P 4A 5P 7M","messiaen's mode #5"],["1P 2M 3M 4P 5d 6m 7m","locrian major","arabian"],["1P 2m 3M 4A 5P 6m 7M","double harmonic lydian"],["1P 2m 2A 3M 4A 6m 7m","altered","super locrian","diminished whole tone","pomeroy"],["1P 2M 3m 4P 5d 6m 7m","locrian #2","half-diminished","aeolian b5"],["1P 2M 3M 4P 5P 6m 7m","mixolydian b6","melodic minor fifth mode","hindu"],["1P 2M 3M 4A 5P 6M 7m","lydian dominant","lydian b7","overtone"],["1P 2M 3M 4A 5A 6M 7M","lydian augmented"],["1P 2m 3m 4P 5P 6M 7m","dorian b2","phrygian #6","melodic minor second mode"],["1P 2m 3m 4d 5d 6m 7d","ultralocrian","superlocrian bb7","superlocrian diminished"],["1P 2m 3m 4P 5d 6M 7m","locrian 6","locrian natural 6","locrian sharp 6"],["1P 2A 3M 4P 5P 5A 7M","augmented heptatonic"],["1P 2M 3m 4A 5P 6M 7m","dorian #4","ukrainian dorian","romanian minor","altered dorian"],["1P 2M 3m 4A 5P 6M 7M","lydian diminished"],["1P 2M 3M 4A 5A 7m 7M","leading whole tone"],["1P 2M 3M 4A 5P 6m 7m","lydian minor"],["1P 2m 3M 4P 5P 6m 7m","phrygian dominant","spanish","phrygian major"],["1P 2m 3m 4P 5P 6m 7M","balinese"],["1P 2m 3m 4P 5P 6M 7M","neopolitan major"],["1P 2M 3M 4P 5P 6m 7M","harmonic major"],["1P 2m 3M 4P 5P 6m 7M","double harmonic major","gypsy"],["1P 2M 3m 4A 5P 6m 7M","hungarian minor"],["1P 2A 3M 4A 5P 6M 7m","hungarian major"],["1P 2m 3M 4P 5d 6M 7m","oriental"],["1P 2m 3m 3M 4A 5P 7m","flamenco"],["1P 2m 3m 4A 5P 6m 7M","todi raga"],["1P 2m 3M 4P 5d 6m 7M","persian"],["1P 2m 3M 5d 6m 7m 7M","enigmatic"],["1P 2M 3M 4P 5A 6M 7M","major augmented","major #5","ionian augmented","ionian #5"],["1P 2A 3M 4A 5P 6M 7M","lydian #9"],["1P 2m 2M 4P 4A 5P 6m 7M","messiaen's mode #4"],["1P 2m 3M 4P 4A 5P 6m 7M","purvi raga"],["1P 2m 3m 3M 4P 5P 6m 7m","spanish heptatonic"],["1P 2M 3m 3M 4P 5P 6M 7m","bebop minor"],["1P 2M 3M 4P 5P 5A 6M 7M","bebop major"],["1P 2m 3m 4P 5d 5P 6m 7m","bebop locrian"],["1P 2M 3m 4P 5P 6m 7m 7M","minor bebop"],["1P 2M 3M 4P 5d 5P 6M 7M","ichikosucho"],["1P 2M 3m 4P 5P 6m 6M 7M","minor six diminished"],["1P 2m 3m 3M 4A 5P 6M 7m","half-whole diminished","dominant diminished","messiaen's mode #2"],["1P 3m 3M 4P 5P 6M 7m 7M","kafi raga"],["1P 2M 3M 4P 4A 5A 6A 7M","messiaen's mode #6"],["1P 2M 3m 3M 4P 5d 5P 6M 7m","composite blues"],["1P 2M 3m 3M 4A 5P 6m 7m 7M","messiaen's mode #3"],["1P 2m 2M 3m 4P 4A 5P 6m 6M 7M","messiaen's mode #7"],["1P 2m 2M 3m 3M 4P 5d 5P 6m 6M 7m 7M","chromatic"]].forEach(([e,n,...t])=>(function(e,n,t=[]){let r={...R(e),name:n,intervals:e,aliases:t};return ei.push(r),ea[r.name]=r,ea[r.setNum]=r,ea[r.chroma]=r,r.aliases.forEach(e=>{ea[e]=r}),r})(e.split(" "),n,t));var es={empty:!0,name:"",symbol:"",root:"",bass:"",rootDegree:0,type:"",tonic:null,setNum:NaN,quality:"Unknown",chroma:"",normalized:"",aliases:[],notes:[],intervals:[]};function eP(e,n){let t=n.split("/");if(1===t.length)return[e,t[0],""];let[r,m,i,a]=x(t[1]);return""!==r&&""===i&&""===a?[e,t[0],r+m]:[e,n,""]}function eu(e,n,t){let r=Y(e),m=N(n||""),i=N(t||"");if(r.empty||n&&m.empty||t&&i.empty)return es;let a=C(m.pc,i.pc),o=r.intervals.indexOf(a),l=o>=0,s=l?i:N(""),P=-1===o?NaN:o+1,u=i.pc&&i.pc!==m.pc,M=Array.from(r.intervals);if(l)for(let e=1;e<P;e++){let e=M[0][0],n=M[0][1],t=parseInt(e,10)+7;M.push(`${t}${n}`),M.shift()}else if(u){let e=et(C(m.pc,i.pc),"8P");e&&M.unshift(e)}let c=m.empty?[]:M.map(e=>D(m.pc,e));e=-1!==r.aliases.indexOf(e)?e:r.aliases[0];let d=`${m.empty?"":m.pc}${e}${l&&P>1?"/"+s.pc:u?"/"+i.pc:""}`,h=`${n?m.pc+" ":""}${r.name}${l&&P>1?" over "+s.pc:u?" over "+i.pc:""}`;return{...r,name:h,symbol:d,tonic:m.pc,type:r.name,root:s.pc,bass:u?i.pc:"",intervals:M,rootDegree:P,notes:c}}var eM=[];[[.125,"dl",["large","duplex longa","maxima","octuple","octuple whole"]],[.25,"l",["long","longa"]],[.5,"d",["double whole","double","breve"]],[1,"w",["whole","semibreve"]],[2,"h",["half","minim"]],[4,"q",["quarter","crotchet"]],[8,"e",["eighth","quaver"]],[16,"s",["sixteenth","semiquaver"]],[32,"t",["thirty-second","demisemiquaver"]],[64,"sf",["sixty-fourth","hemidemisemiquaver"]],[128,"h",["hundred twenty-eighth"]],[256,"th",["two hundred fifty-sixth"]]].forEach(([e,n,t])=>{eM.push({empty:!1,dots:"",name:"",value:1/e,fraction:e<1?[1/e,1]:[1,e],shorthand:n,names:t})});var ec=Math.log(2),ed=Math.log(440);function eh(e){return Math.round(100*(12*(Math.log(e)-ed)/ec+69))/100}var ep="C C# D D# E F F# G G# A A# B".split(" "),ef="C Db D Eb E F Gb G Ab A Bb B".split(" ");function eb(e,n={}){if(isNaN(e)||e===-1/0||e===1/0)return"";e=Math.round(e);let t=(!0===n.sharps?ep:ef)[e%12];return n.pitchClass?t:t+(Math.floor(e/12)-1)}var ey=["C","D","E","F","G","A","B"],eA=e=>e.name,eg=e=>e.map(N).filter(e=>!e.empty),ev=e=>n=>D(n,e),ej=e=>n=>D(e,n);function eN(e,n){return D(e,[n,0])}var eI=(e,n)=>e.height-n.height;function ex(e,n){return n=n||eI,eg(e).sort(n).map(eA)}function eT(e){return ex(e,eI).filter((e,n,t)=>0===n||e!==t[n-1])}function ew(e,n){let t=N(e);if(t.empty)return"";let r=N(n||eb(t.midi||t.chroma,{sharps:t.alt<0,pitchClass:!0}));if(r.empty||r.chroma!==t.chroma)return"";if(void 0===t.oct)return r.pc;let m=t.chroma-t.alt,i=r.chroma-r.alt,a=t.oct+(m>11||i<0?-1:m<0||i>11?1:0);return r.pc+a}var eD={names:function(e){return void 0===e?ey.slice():Array.isArray(e)?eg(e).map(eA):[]},get:N,name:e=>N(e).name,pitchClass:e=>N(e).pc,accidentals:e=>N(e).acc,octave:e=>N(e).oct,midi:e=>N(e).midi,ascending:eI,descending:(e,n)=>n.height-e.height,sortedNames:ex,sortedUniqNames:eT,fromMidi:function(e){return eb(e)},fromMidiSharps:function(e){return eb(e,{sharps:!0})},freq:e=>N(e).freq,fromFreq:function(e){return eb(eh(e))},fromFreqSharps:function(e){return eb(eh(e),{sharps:!0})},chroma:e=>N(e).chroma,transpose:D,tr:D,transposeBy:ev,trBy:ev,transposeFrom:ej,trFrom:ej,transposeFifths:eN,transposeOctaves:function(e,n){return D(e,[0,n])},trFifths:eN,simplify:e=>{let n=N(e);return n.empty?"":eb(n.midi||n.chroma,{sharps:n.alt>0,pitchClass:null===n.midi})},enharmonic:ew},eS={empty:!0,name:"",chordType:""},eC={};function eV(e){return"string"==typeof e?eC[e]||(eC[e]=function(e){let[n,t,r,m]=eE.exec(e)||["","","",""];if(!r)return eS;let i=r.toUpperCase(),a=ek.indexOf(i),o=j(t);return{empty:!1,name:n,roman:r,interval:d({step:a,alt:o,dir:1}).name,acc:t,chordType:m,alt:o,step:a,major:r===i,oct:0,dir:1}}(e)):"number"==typeof e?eV(ek[e]||""):m(e)?eV(v(e.alt)+ek[e.step]):E(e)?eV(e.name):eS}V("RomanNumeral.romanNumeral","RomanNumeral.get",eV);var eE=/^(#{1,}|b{1,}|x{1,}|)(IV|I{1,3}|VI{0,2}|iv|i{1,3}|vi{0,2})([^IViv]*)$/,e$="I II III IV V VI VII",ek=e$.split(" ");e$.toLowerCase().split(" "),Object.freeze([]);var eF=(e,n,t="")=>n.map((n,r)=>`${e[r]}${t}${n}`);function eq(e,n,t,r,m){return i=>{let a=e.map(e=>eV(e).interval||""),o=a.map(e=>D(i,e));return{tonic:i,grades:e,intervals:a,scale:o,triads:eF(o,n),chords:eF(o,t),chordsHarmonicFunction:r.slice(),chordScales:eF(o,m," ")}}}eq("I II III IV V VI VII".split(" ")," m m   m dim".split(" "),"maj7 m7 m7 maj7 7 m7 m7b5".split(" "),"T SD T SD D T D".split(" "),"major,dorian,phrygian,lydian,mixolydian,minor,locrian".split(",")),eq("I II bIII IV V bVI bVII".split(" "),"m dim  m m  ".split(" "),"m7 m7b5 maj7 m7 m7 maj7 7".split(" "),"T SD T SD D SD SD".split(" "),"minor,locrian,major,dorian,phrygian,lydian,mixolydian".split(",")),eq("I II bIII IV V bVI VII".split(" "),"m dim aug m   dim".split(" "),"mMaj7 m7b5 +maj7 m7 7 maj7 o7".split(" "),"T SD T SD D SD D".split(" "),"harmonic minor,locrian 6,major augmented,lydian diminished,phrygian dominant,lydian #9,ultralocrian".split(",")),eq("I II bIII IV V VI VII".split(" "),"m m aug   dim dim".split(" "),"m6 m7 +maj7 7 7 m7b5 m7b5".split(" "),"T SD T SD D  ".split(" "),"melodic minor,dorian b2,lydian augmented,lydian dominant,mixolydian b6,locrian #2,altered".split(","));var eO=[[0,2773,0,"ionian","","Maj7","major"],[1,2902,2,"dorian","m","m7"],[2,3418,4,"phrygian","m","m7"],[3,2741,-1,"lydian","","Maj7"],[4,2774,1,"mixolydian","","7"],[5,2906,3,"aeolian","m","m7","minor"],[6,3434,5,"locrian","dim","m7b5"]],e_={...q,name:"",alt:0,modeNum:NaN,triad:"",seventh:"",aliases:[]},ez=eO.map(function(e){let[n,t,r,m,i,a,o]=e,l=Number(t).toString(2);return{empty:!1,intervals:eo(m).intervals,modeNum:n,chroma:l,normalized:l,name:m,setNum:t,alt:r,triad:i,seventh:a,aliases:o?[o]:[]}}),eG={};function eL(e){return"string"==typeof e?eG[e.toLowerCase()]||e_:e&&e.name?eL(e.name):e_}function eB(e){return(n,t)=>{let r=eL(n);if(r.empty)return[];let m=k(r.modeNum,e),i=r.intervals.map(e=>D(t,e));return m.map((e,n)=>i[n]+e)}}function eU(e){let n=F(e.map(e=>"number"==typeof e?e:function(e){if(+e>=0&&127>=+e)return+e;let n=N(e);return n.empty?null:n.midi}(e)));return e.length&&n.length===e.length?n.reduce((e,n)=>{let t=e[e.length-1];return e.concat($(t,n).slice(1))},[n[0]]):[]}ez.forEach(e=>{eG[e.name]=e,e.aliases.forEach(n=>{eG[n]=e})}),V("Mode.mode","Mode.get",eL),V("Mode.mode","Mode.all",function(){return ez.slice()}),eB(eO.map(e=>e[4])),eB(eO.map(e=>e[5]));var eR={numeric:eU,chromatic:function(e,n){return eU(e).map(e=>eb(e,n))}},eH={empty:!0,name:"",type:"",tonic:null,setNum:NaN,chroma:"",normalized:"",aliases:[],notes:[],intervals:[]};function eJ(e){if("string"!=typeof e)return["",""];let n=e.indexOf(" "),t=N(e.substring(0,n));if(t.empty){let n=N(e);return n.empty?["",e]:[n.name,""]}let r=e.substring(t.name.length+1);return[t.name,r.length?r:""]}function eK(e){let n=Array.isArray(e)?e:eJ(e),t=N(n[0]).name,r=eo(n[1]);if(r.empty)return eH;let m=r.name,i=t?r.intervals.map(e=>D(t,e)):[],a=t?t+" "+m:m;return{...r,name:a,type:m,tonic:t,notes:i}}var eQ=V("Scale.scale","Scale.get",eK);function eW(e){let n=function(e){let n=R(e).setNum;return e=>{let t=R(e).setNum;return n&&n!==t&&(t|n)===t}}(G(e)?e:eK(e).chroma);return el().filter(e=>n(e.chroma)).map(e=>e.name)}function eX(e){let n=e.map(e=>N(e).pc).filter(e=>e),t=n[0],r=eT(n);return k(r.indexOf(t),r)}var eY={degrees:function(e){let{intervals:n,tonic:t}=eK(e),r=S(n,t);return e=>e?r(e>0?e-1:e):""},detect:function(e,n={}){let t=H(e),r=N(n.tonic??e[0]??""),m=r.chroma;if(void 0===m)return[];let i=t.split("");i[m]="1";let a=k(m,i).join(""),o=el().find(e=>e.chroma===a),l=[];return o&&l.push(r.name+" "+o.name),"exact"===n.match||eW(a).forEach(e=>{l.push(r.name+" "+e)}),l},extended:eW,get:eK,modeNames:function(e){let n=eK(e);if(n.empty)return[];let t=n.tonic?n.notes:n.intervals;return(function(e,n=!0){let t=R(e).chroma.split("");return F(t.map((e,r)=>{let m=k(r,t);return n&&"0"===m[0]?null:m.join("")}))})(n.chroma).map((e,n)=>{let r=eK(e).name;return r?[t[n],r]:["",""]}).filter(e=>e[0])},names:function(){return ei.map(e=>e.name)},rangeOf:function(e){let n=function(e){let n=Array.isArray(e)?eX(e):eK(e).notes,t=n.map(e=>N(e).chroma);return e=>{let r="number"==typeof e?N(eb(e)):N(e),m=r.height;if(void 0===m)return;let i=t.indexOf(m%12);if(-1!==i)return ew(r.name,n[i])}}(e);return(e,t)=>{let r=N(e).height,m=N(t).height;return void 0===r||void 0===m?[]:$(r,m).map(n).filter(e=>e)}},reduced:function(e){let n=K(eK(e).chroma);return el().filter(e=>n(e.chroma)).map(e=>e.name)},scaleChords:function(e){let n=K(eK(e).chroma);return Z().filter(e=>n(e.chroma)).map(e=>e.aliases[0])},scaleNotes:eX,steps:function(e){let{intervals:n,tonic:t}=eK(e);return S(n,t)},tokenize:eJ,scale:eQ}}}]);