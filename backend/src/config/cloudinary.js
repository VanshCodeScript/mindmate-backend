const cloudinary = require('cloudinary').v2;

/**
 * Cloudinary Configuration Module
 * Handles image and file uploads to Cloudinary CDN
 */

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Local file path or base64 data
 * @param {object} options - Upload options
 * @returns {Promise<object>} Upload result with url and publicId
 */
const uploadToCloudinary = async (filePath, options = {}) => {
  try {
    const defaultOptions = {
      resource_type: 'auto',
      folder: 'mindbridge',
      use_filename: true,
      unique_filename: true,
    };

    const result = await cloudinary.uploader.upload(filePath, {
      ...defaultOptions,
      ...options,
    });

    console.log(`✅ Uploaded to Cloudinary: ${result.public_id}`);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      type: result.type,
      size: result.bytes,
    };
  } catch (error) {
    console.error('❌ Cloudinary Upload Error:', error.message);
    throw error;
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Public ID of the file to delete
 * @returns {Promise<object>} Deletion result
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    console.log(`✅ Deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    console.error('❌ Cloudinary Deletion Error:', error.message);
    throw error;
  }
};

/**
 * Generate optimized image URL with transformations
 * @param {string} publicId - Public ID of the image
 * @param {object} transformations - Cloudinary transformation options
 * @returns {string} Optimized image URL
 */
const getOptimizedImageUrl = (publicId, transformations = {}) => {
  const defaultTransform = {
    quality: 'auto',
    fetch_format: 'auto',
    responsive: true,
  };

  const url = cloudinary.url(publicId, {
    ...defaultTransform,
    ...transformations,
  });

  return url;
};

/**
 * Get thumbnail URL
 * @param {string} publicId - Public ID of the image
 * @param {number} width - Thumbnail width in pixels
 * @param {number} height - Thumbnail height in pixels
 * @returns {string} Thumbnail URL
 */
const getThumbnailUrl = (publicId, width = 200, height = 200) => {
  return getOptimizedImageUrl(publicId, {
    width,
    height,
    crop: 'fill',
    gravity: 'face',
  });
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  getOptimizedImageUrl,
  getThumbnailUrl,
};
