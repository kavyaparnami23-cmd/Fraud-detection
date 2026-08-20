const baseURL = import.meta.env.VITE_API_BASE_URL ?? "";

async function request(method, url, body) {
  const token = localStorage.getItem("token");
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${baseURL}${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (typeof data?.error === "string" && data.error) ||
      (typeof data?.message === "string" && data.message) ||
      res.statusText;
    const err = new Error(msg);
    err.response = { status: res.status, data };
    throw err;
  }

  return { data };
}

const api = {
  get: (url) => request("GET", url),
  post: (url, body) => request("POST", url, body),
};

export default api;
