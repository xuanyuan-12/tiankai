头像文件夹说明
==============

1. 把头像图片（PNG / JPG / SVG，建议正方形）放进这个 avatars/ 文件夹。
2. 打开 avatars.html，可以预览、选择头像。
3. 想让自己放进来的图片出现在网页里，有两种方式：
   A. 在 manifest.js 里加一行：
      { id: 'my-face', name: '我的头像', file: 'my-face.png' },
      然后刷新 avatars.html 和游戏页面。
   B. 在 avatars.html 里点「从文件夹导入」，选择 avatars/ 文件夹，
      页面会把图片读进来并保存在本机浏览器里，不需要改 manifest.js。
4. 游戏内选择头像后，会记住上次选择。头像只保存在你自己的浏览器里。

注意：浏览器出于安全限制，不能自动扫描本地文件夹；所以需要 manifest.js
或手动「从文件夹导入」。GitHub Pages 上部署时，把图片和 manifest.js 一起上传即可。
