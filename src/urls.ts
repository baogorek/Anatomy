// Vite supplies the deployment prefix; local development can still run at /.
export function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}
