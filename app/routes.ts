import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/chat.tsx"),
  route("/visualization", "routes/visualization.tsx"),
] satisfies RouteConfig;