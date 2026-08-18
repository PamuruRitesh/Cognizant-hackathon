export const API_BASE = 'http://localhost:8000';
export const shortenId = (id) => {
  if (!id) return '';
  return id.length > 8 ? `${id.substring(0, 4)}...${id.substring(id.length - 4)}` : id;
};
