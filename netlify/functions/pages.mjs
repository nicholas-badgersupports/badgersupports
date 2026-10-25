/* Every page address — drawn with the published revision of saved words (netlify/lib/pages.mjs). The files
   the build hashes or writes for download (assets, photos, calendar files, robots.txt, the sitemap) and the
   API are left to their own answers. */

import { handlePage } from "../lib/pages.mjs";

export default async (req) => handlePage(req);

export const config = {
  path: "/*",
  excludedPath: ["/api/*", "/assets/*", "/media/*", "/calendar/*", "/robots.txt", "/sitemap.xml", "/favicon.ico"],
};
