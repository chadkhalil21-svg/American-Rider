#!/usr/bin/env python3
"""Owner-approved, single-app, single-build App Store review submission.
No developer/private key is logged or committed. Fail closed on Apple errors.
"""
import base64, json, os, sys, time, urllib.error, urllib.parse, urllib.request
import jwt

APP_ID = "6798078543"
BUNDLE = "com.americanrider.app"
VERSION = "1.0"
BUILD_NUMBER = "53"
BASE = "https://api.appstoreconnect.apple.com/v1"

def fail(message):
    raise RuntimeError(message)

raw = os.environ.get("ASC_API_KEY_BASE64","")
if not raw:
    fail("Existing App Store Connect key is unavailable in this legacy GitHub repository")
private_key = base64.b64decode(raw)
token = jwt.encode(
    {"iss":os.environ["ASC_ISSUER_ID"],"iat":int(time.time()),
     "exp":int(time.time())+600,"aud":"appstoreconnect-v1"},
    private_key,algorithm="ES256",
    headers={"kid":os.environ["ASC_KEY_ID"],"typ":"JWT"})

def req(method,path,query=None,payload=None):
    url = BASE+path+("?" + urllib.parse.urlencode(query) if query else "")
    body = json.dumps(payload).encode() if payload is not None else None
    headers = {"Authorization":"Bearer "+token,"Accept":"application/json"}
    if body is not None: headers["Content-Type"]="application/json"
    request = urllib.request.Request(url,data=body,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=40) as resp:
            answer=resp.read(800000)
            return json.loads(answer) if answer else {}
    except urllib.error.HTTPError as exc:
        try:
            obj=json.loads(exc.read(16000))
            errs=[{"status":x.get("status"),"code":x.get("code"),
                   "detail":str(x.get("detail",""))[:250]} for x in obj.get("errors",[])][:5]
        except Exception: errs=[]
        fail("APP_STORE_CONNECT_API_REJECTED "+method+" "+path+" HTTP "+str(exc.code)+" "+json.dumps(errs))

def log(tag,obj):
    print(tag,json.dumps(obj,sort_keys=True),flush=True)

app=req("GET","/apps/"+APP_ID)["data"]
if app.get("id")!=APP_ID or app.get("attributes",{}).get("bundleId")!=BUNDLE:
    fail("App ID or bundle mismatch, refusing submission")
log("VERIFIED_APP",{"id":APP_ID,"bundle":BUNDLE})

builds=req("GET","/builds",{"filter[app]":APP_ID,
           "filter[preReleaseVersion.version]":"1.0.0",
           "fields[builds]":"version,processingState,expired","limit":"200"}).get("data",[])
matches=[b for b in builds if b.get("attributes",{}).get("version")==BUILD_NUMBER]
if len(matches)!=1:fail("Exactly one processed iOS Build 53 is required")
build=matches[0]
if build["attributes"].get("processingState")!="VALID" or build["attributes"].get("expired") is not False:
    fail("Build 53 is not valid and unexpired")
log("VERIFIED_BUILD",{"number":BUILD_NUMBER,"id":build["id"],"processingState":"VALID"})

versions=req("GET","/apps/"+APP_ID+"/appStoreVersions",
             {"filter[platform]":"IOS","limit":"100"}).get("data",[])
chosen=[v for v in versions if v.get("attributes",{}).get("versionString")==VERSION and
        v.get("attributes",{}).get("platform")=="IOS"]
if len(chosen)!=1:fail("Exactly one 1.0 iOS public App Store version is required")
version=chosen[0]
vid=version["id"]
state=version["attributes"].get("appStoreState")
log("APP_STORE_VERSION",{"id":vid,"version":VERSION,"state":state,
    "releaseType":version["attributes"].get("releaseType")})
if state not in ("PREPARE_FOR_SUBMISSION","READY_FOR_REVIEW"):
    if state in ("WAITING_FOR_REVIEW","IN_REVIEW","PENDING_DEVELOPER_RELEASE","READY_FOR_DISTRIBUTION"):
        log("ALREADY_SUBMITTED_OR_RELEASED",{"state":state})
        sys.exit(0)
    fail("Version is not in a safely editable pre-submission state")

# Require the actual currently valid Build 53, not legacy Build 47.
current=req("GET","/appStoreVersions/"+vid+"/build").get("data")
if not current or current.get("id")!=build["id"]:
    req("PATCH","/appStoreVersions/"+vid+"/relationships/build",
       payload={"data":{"type":"builds","id":build["id"]}})
actual=req("GET","/appStoreVersions/"+vid+"/build").get("data")
if not actual or actual.get("id")!=build["id"]:fail("Apple did not attach Build 53")
log("APP_STORE_BUILD_ATTACHED",{"version":VERSION,"build":BUILD_NUMBER})

subs=req("GET","/apps/"+APP_ID+"/reviewSubmissions",
         {"filter[platform]":"IOS","limit":"100"}).get("data",[])
open_subs=[s for s in subs if s.get("attributes",{}).get("state") in
           ("READY_FOR_REVIEW","WAITING_FOR_REVIEW","IN_REVIEW")]
running=[s for s in open_subs if s["attributes"]["state"] in ("WAITING_FOR_REVIEW","IN_REVIEW")]
if running:
    log("REVIEW_ALREADY_ONGOING",{"state":running[0]["attributes"]["state"]})
    sys.exit(0)
drafts=[s for s in open_subs if s["attributes"]["state"]=="READY_FOR_REVIEW"]
if len(drafts)>1:fail("Multiple Apple draft submissions; do not guess which one")
if drafts:
    review=drafts[0]
else:
    review=req("POST","/reviewSubmissions",payload={
      "data":{"type":"reviewSubmissions",
              "relationships":{"app":{"data":{"type":"apps","id":APP_ID}}}}
    })["data"]
review_id=review["id"]
log("REVIEW_DRAFT",{"id":review_id})

items=req("GET","/reviewSubmissions/"+review_id+"/items",{"limit":"100"}).get("data",[])
matching=[i for i in items
          if i.get("relationships",{}).get("appStoreVersion",{}).get("data",{}).get("id")==vid]
if not matching:
    req("POST","/reviewSubmissionItems",payload={
      "data":{"type":"reviewSubmissionItems","relationships":{
        "reviewSubmission":{"data":{"type":"reviewSubmissions","id":review_id}},
        "appStoreVersion":{"data":{"type":"appStoreVersions","id":vid}}
      }}
    })
log("REVIEW_ITEM_READY",{"version":VERSION,"build":BUILD_NUMBER})
req("PATCH","/reviewSubmissions/"+review_id,payload={
  "data":{"type":"reviewSubmissions","id":review_id,
          "attributes":{"submitted":True}}
})
check=req("GET","/reviewSubmissions/"+review_id)["data"]
review_state=check.get("attributes",{}).get("state")
log("APPLE_PUBLIC_APP_REVIEW_SUBMISSION_RESULT",
    {"reviewId":review_id,"state":review_state,"iosVersion":VERSION,"build":BUILD_NUMBER})
if review_state not in ("WAITING_FOR_REVIEW","IN_REVIEW","COMPLETE"):
    fail("Review submit API returned but state is not confirmed received by Apple")
print("PUBLIC_APP_REVIEW_SUBMITTED_CONFIRMED")
