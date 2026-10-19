# Gem Rush
A 45-second Three.js gem collector for start.ng. Your start.ng character is the player.

## One-time setup (needs the two three.js files)
In this folder run:

    npm install three
    mkdir vendor
    copy node_modules\three\build\three.module.js vendor\
    copy node_modules\three\build\three.core.js vendor\

Then delete `node_modules`, `package.json` and `package-lock.json` (not needed) and push.
Test locally: `npx serve .` and open the shown address.
