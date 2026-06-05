import api from "./api";

export const uploadResume = async ({ file, onProgress }: { file: File; onProgress?: (percent: number) => void }) => {
  const formData = new FormData();
  formData.append("resume", file);

  const response = await api.post("/api/resume/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (!event.total) {
        return;
      }

      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress?.(percent);
    },
  });

  return response.data;
};

export const fetchResumeHistory = async () => {
  const response = await api.get("/api/resume/history");
  return response.data;
};

export const fetchResumeById = async (id: string) => {
  const response = await api.get(`/api/resume/${id}`);
  return response.data;
};

export const fetchResumeStatus = async (jobId: string) => {
  const response = await api.get(`/api/resume/status/${jobId}`);
  return response.data;
};
