import { clientOnly } from "@solidjs/start";

const SwaggerUI = clientOnly(() => import("~/components/swagger-ui"));

export default function SwaggerPage() {
  return (
    <div class="container mx-auto p-4">
      <h1 class="text-2xl font-bold mb-4">API Documentation</h1>
      <SwaggerUI />
    </div>
  );
}
