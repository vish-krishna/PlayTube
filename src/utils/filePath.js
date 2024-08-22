const getFilesPath = (req, field) => {
    if (
        req.files &&
        req.files[field] &&
        req.files[field].length > 0 &&
        req.files[field][0] &&
        req.files[field][0]['path']
    ) {
        return req.files[field][0]['path'];
    }
    return null;
};

export { getFilesPath };
