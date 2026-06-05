export const formatDate = (value: string | number | Date) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const formatNumber = (value: string | number) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-US").format(number);
};
