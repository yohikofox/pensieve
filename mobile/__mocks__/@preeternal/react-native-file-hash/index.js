// Mock for @preeternal/react-native-file-hash
// Returns valid hashes for known Whisper model files by default

// SHA256 hashes for Whisper models (matching WhisperModelService.ts)
const VALID_HASHES = {
  tiny: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
  base: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  small: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',
};

// Allow tests to override the hash per file
let fileHashOverrides = {};
let shouldReturnInvalidHash = false;

module.exports = {
  fileHash: jest.fn(async (filePath, algorithm) => {
    // Return override if set
    if (fileHashOverrides[filePath]) {
      return fileHashOverrides[filePath];
    }
    // Return invalid hash if test requested it
    if (shouldReturnInvalidHash) {
      return 'invalidhash1234567890abcdef1234567890abcdef1234567890abcdef';
    }
    // Return correct hash based on model in filename
    if (filePath.includes('tiny')) return VALID_HASHES.tiny;
    if (filePath.includes('base')) return VALID_HASHES.base;
    if (filePath.includes('small')) return VALID_HASHES.small;
    // Default for unknown files
    return VALID_HASHES.tiny;
  }),
  hashString: jest.fn(async (text, algorithm) => {
    return VALID_HASHES.tiny;
  }),
  // Helper for tests to set expected hash
  __setMockHash: (filePath, hash) => {
    fileHashOverrides[filePath] = hash;
  },
  __clearMockHashes: () => {
    fileHashOverrides = {};
    shouldReturnInvalidHash = false;
  },
  // Helper to simulate corrupted file
  __setReturnInvalidHash: (invalid) => {
    shouldReturnInvalidHash = invalid;
  },
};
