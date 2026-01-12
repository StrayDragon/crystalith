const DEFAULT_HEADERS = {
  Accept: 'application/json',
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const message = detail || response.statusText || '请求失败';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function listNotebooks() {
  return request('/v1/notebooks');
}

export async function createNotebook(name) {
  return request('/v1/notebooks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
}

export async function listSources(notebookId) {
  return request(`/v1/notebooks/${notebookId}/sources`);
}

export async function uploadSource(notebookId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return request(`/v1/notebooks/${notebookId}/sources`, {
    method: 'POST',
    body: formData,
  });
}

export async function askQuestion(notebookId, question) {
  return request(`/v1/notebooks/${notebookId}/qa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question }),
  });
}

export async function refinePrompt(notebookId, prompt, format) {
  return request(`/v1/notebooks/${notebookId}/refine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, format }),
  });
}

export async function refineBatch(notebookId, prompt, formats) {
  return request(`/v1/notebooks/${notebookId}/refine/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, formats }),
  });
}
