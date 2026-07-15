/** @type {import('next').NextConfig} */
import dotenv from 'dotenv';
import withAntdLess from 'next-plugin-antd-less';

dotenv.config({ path: 'configs/.env' });

const CORS_HEADERS = [
    { 
      key: "Access-Control-Allow-Credentials", 
      value: "true" 
    },
    { 
      key: "Access-Control-Allow-Origin",
      value: "*" 
    },
    { 
      key: "Access-Control-Allow-Methods", 
      value: "GET,DELETE,PATCH,POST,PUT" 
    },
    {
      key: "Access-Control-Allow-Headers",
      value: "Content-Type, Authorization",
    },
];

function normalizeBasePath(value) {
  const path = (value || "").trim().replace(/^\/+|\/+$/g, "");
  return path ? `/${path}` : "";
}

const appBasePath = normalizeBasePath(process.env.APP_BASE_PATH ?? "/suffer-web");

const nextConfig = {
    basePath: appBasePath,
    env: {
      APP_BASE_PATH: appBasePath,
    },
    reactStrictMode: false,
    async headers() {
        // 跨域配置
        return [
          {
            source: "/favicon.ico",
            headers: [
              {
              key: "Cache-Control",
              value: "public, max-age=86400",
              },
            ],
          },
          {
              source: "/api/:path*", // 为访问 /api/** 的请求添加 CORS HTTP Headers
              headers: CORS_HEADERS
            },
          {
            source: "/specific", // 为特��路径的请求添加 CORS HTTP Headers,
            headers: CORS_HEADERS
          }
        ];
      }
};
export default withAntdLess(nextConfig);
