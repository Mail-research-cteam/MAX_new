'use strict';
// Install with npm ci. No dependency on a developer's cache or username.
const playwright=require('playwright');
const chromium={launch(options={}){const next={...options};delete next.executablePath;
 if(process.env.PW_EXECUTABLE_PATH)next.executablePath=process.env.PW_EXECUTABLE_PATH;
 else if(process.env.PW_BROWSER_CHANNEL)next.channel=process.env.PW_BROWSER_CHANNEL;
 return playwright.chromium.launch(next);
}};
module.exports={...playwright,chromium};
