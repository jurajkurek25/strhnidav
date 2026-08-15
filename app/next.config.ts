import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Default Server Action body limit is 1 MB — lesson video uploads
  // (src/app/admin/actions.ts's saveLesson, via LessonForm's <input
  // type="file" name="video">) are routinely far larger than that.
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
  },
};

export default nextConfig;
