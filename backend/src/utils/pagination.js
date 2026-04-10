const getPagination = (query = {}) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

module.exports = { getPagination };
