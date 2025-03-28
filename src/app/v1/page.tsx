"use client";

import type React from "react";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  Save,
  RefreshCw,
  Trash2,
  XCircle,
  Info,
  ArrowUpCircle,
  Table,
  FileText,
} from "lucide-react";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";

// Make sure this is correctly set in your environment variables
const API_URL = process.env.NEXT_PUBLIC_BASE_URL || "";

export default function ExcelFileManager() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [data, setData] = useState<object[]>([]);
  const [originalData, setOriginalData] = useState<object[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState("");
  const [connectionId, setConnectionId] = useState<string>("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"generated" | "original">(
    "generated"
  );
  const [totalItems, setTotalItems] = useState(0);
  const [processedItems, setProcessedItems] = useState(0);
  const [buttonHover, setButtonHover] = useState(false);

  // Ref to track if we've animated the initial data load
  const initialDataAnimated = useRef(false);
  const uploadCancelTokenRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      setError(null);
      setIsUploading(false);
      setData([]);
      setOriginalData([]);
      setUploadProgress(0);
      setProcessedItems(0);
      setTotalItems(0);
    }
  };

  const connectToServer = async () => {
    try {
      // Generate a unique identifier for the connection
      const uui = await uuidv4();

      if (uui) {
        setConnectionId(uui);
      }
    } catch (error) {
      console.error("Error generating connection ID:", error);
      setError("Error initializing connection. Using offline mode.");
      setIsOfflineMode(true);
    }
  };

  function chunkArray(array: object[], size: number) {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size)
    );
  }

  const validateExcelData = (data: any[]): boolean => {
    // Check if "Part" column exists in the data
    if (data.length === 0) return false;

    const firstRow = data[0];
    const hasPartColumn = Object.keys(firstRow).some(
      (key) => key.toLowerCase() === "part"
    );

    if (!hasPartColumn) {
      setValidationError("Excel file must contain a 'Part' column");
      setShowValidationPopup(true);
      return false;
    }

    return true;
  };

  // Process data locally without API
  const processDataLocally = (extractData: any[]) => {
    setIsUploading(true);
    setTotalItems(extractData.length);
    setProcessedItems(0);

    // Store original data
    setOriginalData([...extractData]);

    // Process items one by one with a small delay to show progress
    const processItems = async () => {
      const processedData = [];

      for (let i = 0; i < extractData.length; i++) {
        // Process each item
        processedData.push(extractData[i]);

        // Update progress
        setProcessedItems(i + 1);
        setUploadProgress(Math.round(((i + 1) / extractData.length) * 100));

        // Small delay to show progress
        if (i < extractData.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      setData(processedData);
      setIsUploading(false);
    };

    processItems();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first!");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    setProcessedItems(0);
    setTotalItems(0);

    // Convert file to JSON using xlsx
    const reader = new FileReader();
    reader.readAsBinaryString(selectedFile);

    reader.onload = async (e) => {
      if (!e.target?.result) return;

      try {
        const binaryStr = e.target.result as string;
        const workbook = XLSX.read(binaryStr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const extractData = (await XLSX.utils.sheet_to_json(sheet)) as object[];

        if (!extractData?.length) {
          setError("No data found in the selected file.");
          setIsUploading(false);
          return;
        }

        // Validate that the data has a "Part" column
        if (!validateExcelData(extractData)) {
          setIsUploading(false);
          return;
        }

        // Store original data
        setOriginalData([...extractData]);
        setTotalItems(extractData.length);

        // Check if we should use offline mode
        if (isOfflineMode || !API_URL) {
          console.log("Using offline mode for processing");
          processDataLocally(extractData);
          return;
        }

        // Process items one by one
        const processedData = [];

        for (let i = 0; i < extractData.length; i++) {
          // Create a cancel token
          const cancelTokenSource = axios.CancelToken.source();
          uploadCancelTokenRef.current = cancelTokenSource;

          try {
            const response = await axios.post(
              `${API_URL}/scrape`,
              {
                sheets: [extractData[i]],
                connectionId,
              },
              {
                headers: { "Content-Type": "application/json" },
                timeout: 150000,
                cancelToken: cancelTokenSource.token,
              }
            );

            if (response?.data && response?.data?.success === true) {
              if (response?.data?.data?.length > 0) {
                processedData.push(...response.data.data);
              } else {
                // If no data returned, use the original item
                processedData.push(extractData[i]);
              }
            } else {
              // If response is not successful, use the original item
              processedData.push(extractData[i]);
            }
          } catch (error: any) {
            if (axios.isCancel(error)) {
              console.log("Request canceled:", error.message);
              setError("Upload canceled.");
              break;
            } else {
              console.error("API request failed:", error);

              // If we encounter a network error, switch to offline mode
              if (error.message === "Network Error") {
                setError("Network error detected. Switching to offline mode.");
                setIsOfflineMode(true);

                // Process the remaining data locally
                const remainingData = extractData.slice(i);
                processDataLocally(remainingData);
                break;
              } else {
                // Continue with the original item on error
                processedData.push(extractData[i]);
              }
            }
          }

          setProcessedItems(i + 1);
          setUploadProgress(Math.round(((i + 1) / extractData.length) * 100));

          // Small delay to prevent overwhelming the API
          if (i < extractData.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }

        setData(processedData);
        setIsUploading(false);
      } catch (error: any) {
        console.error("Error processing file:", error);
        setError(`Error processing file: ${error.message || "Unknown error"}`);
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      console.error("File reading error");
      setError("Failed to read the file. Please try again.");
      setIsUploading(false);
    };
  };

  const handleExportToExcel = () => {
    if (data.length === 0 && originalData.length === 0) {
      setError("No data to export!");
      return;
    }

    // Show the download popup
    setDownloadFileName(
      selectedFile
        ? selectedFile.name.replace(".xlsx", "") + "_exported"
        : "exported_data"
    );
    setShowDownloadPopup(true);
  };

  const confirmDownload = () => {
    if (data.length === 0 && originalData.length === 0) {
      setError("No data to export!");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress(0);

    // Simulate download progress
    const progressInterval = setInterval(() => {
      setDownloadProgress((prev) => {
        const newProgress = prev + Math.random() * 15;
        if (newProgress >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return newProgress;
      });
    }, 200);

    try {
      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Convert data to worksheet
      const wsGenerated = XLSX.utils.json_to_sheet(data);
      const wsOriginal = XLSX.utils.json_to_sheet(originalData);

      // Add worksheets to workbook
      XLSX.utils.book_append_sheet(wb, wsGenerated, "Generated Data");
      XLSX.utils.book_append_sheet(wb, wsOriginal, "Original Data");

      // Generate filename with .xlsx extension if not present
      const filename = downloadFileName.endsWith(".xlsx")
        ? downloadFileName
        : `${downloadFileName}.xlsx`;

      // Write and download
      setTimeout(() => {
        XLSX.writeFile(wb, filename);
        setIsDownloading(false);
        setDownloadProgress(100);

        // Close popup after a short delay
        setTimeout(() => {
          setShowDownloadPopup(false);
          setDownloadProgress(0);
        }, 1000);
      }, 1500);
    } catch (error: any) {
      console.error("Error exporting file:", error);
      setError(`Error exporting file: ${error.message || "Unknown error"}`);
      setIsDownloading(false);
      clearInterval(progressInterval);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setData([]);
    setOriginalData([]);
    setError(null);
    setIsUploading(false);
    setUploadProgress(0);
    setProcessedItems(0);
    setTotalItems(0);
    initialDataAnimated.current = false;

    // Reset the file input element to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancelUpload = () => {
    if (uploadCancelTokenRef.current) {
      uploadCancelTokenRef.current.cancel("Operation canceled by the user");
      uploadCancelTokenRef.current = null;
    }
    setIsUploading(false);
  };

  const toggleOfflineMode = () => {
    setIsOfflineMode(!isOfflineMode);
    setError(
      isOfflineMode
        ? null
        : "Switched to offline mode. Data will be processed locally."
    );
  };

  useEffect(() => {
    connectToServer();

    // Check if API_URL is available
    if (!API_URL) {
      console.warn("API_URL is not defined. Switching to offline mode.");
      setIsOfflineMode(true);
      setError("API URL not configured. Using offline mode.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-emerald-500 mb-2">
            Excel File Manager
          </h1>
          <p className="text-gray-400">
            Upload, process, and download Excel files
          </p>
          {isOfflineMode && (
            <div className="mt-2 inline-flex items-center gap-2 bg-yellow-900/30 text-yellow-300 px-3 py-1 rounded-full text-sm">
              <Info className="h-4 w-4" />
              Offline Mode
              <button
                onClick={toggleOfflineMode}
                className="text-xs bg-yellow-800 hover:bg-yellow-700 px-2 py-0.5 rounded ml-1"
              >
                {isOfflineMode ? "Try Online" : "Use Offline"}
              </button>
            </div>
          )}
        </header>

        {/* Upload Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-lg mb-8">
          <div className="p-5 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
              <h2 className="text-xl font-semibold text-white">
                Upload Excel File
              </h2>
            </div>
            <p className="text-gray-400 mt-1 text-sm">
              Select an Excel file (.xlsx) to upload and process
            </p>
          </div>

          <div className="p-5">
            <div className="flex flex-col gap-4">
              <div className="relative w-full">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-gray-500" />
                  <p className="text-gray-400 mb-1">
                    {selectedFile
                      ? selectedFile.name
                      : "Drag & drop or click to select"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(2)} KB`
                      : "Excel files only (.xlsx)"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <motion.button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  onMouseEnter={() => setButtonHover(true)}
                  onMouseLeave={() => setButtonHover(false)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`px-4 py-3 rounded-md font-medium flex items-center justify-center gap-2
                    ${
                      !selectedFile || isUploading
                        ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-emerald-800 to-emerald-600 hover:from-emerald-700 hover:to-emerald-500 text-white shadow-lg"
                    } 
                    transition-all duration-300`}
                >
                  {isUploading ? (
                    <>
                      <div className="h-5 w-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="h-5 w-5" />
                      Upload File
                    </>
                  )}
                </motion.button>

                {isUploading && (
                  <motion.button
                    onClick={handleCancelUpload}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-4 py-3 rounded-md font-medium flex items-center justify-center gap-2 bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white shadow-lg transition-all duration-300"
                  >
                    <XCircle className="h-5 w-5" />
                    Cancel
                  </motion.button>
                )}

                <motion.button
                  onClick={handleReset}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-4 py-3 rounded-md font-medium flex items-center justify-center gap-2 bg-gradient-to-r from-blue-800 to-blue-600 hover:from-blue-700 hover:to-blue-500 text-white shadow-lg transition-all duration-300"
                >
                  <RefreshCw className="h-5 w-5" />
                  Reset
                </motion.button>
              </div>
            </div>

            {isUploading && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>
                    Processing items: {processedItems}/{totalItems}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    className="bg-emerald-500 h-2.5 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p>{error}</p>
                  {error.includes("Network") && (
                    <button
                      onClick={toggleOfflineMode}
                      className="mt-2 text-sm bg-red-800 hover:bg-red-700 px-3 py-1 rounded"
                    >
                      {isOfflineMode
                        ? "Try Online Mode"
                        : "Switch to Offline Mode"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* File Actions Card */}
        {(data.length > 0 || originalData.length > 0) && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-lg mb-8">
            <div className="p-5 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-white">File Actions</h2>
              <p className="text-gray-400 mt-1 text-sm">
                Download, export or clear the processed data
              </p>
            </div>
            <div className="p-5 flex flex-wrap gap-4">
              <motion.button
                onClick={handleExportToExcel}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex-1 bg-gradient-to-r from-blue-800 to-blue-600 hover:from-blue-700 hover:to-blue-500 text-white px-4 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-all duration-300 shadow-lg min-w-[180px]"
              >
                <Save className="h-5 w-5" />
                Export to Excel
              </motion.button>

              <motion.button
                onClick={() => {
                  setData([]);
                  setOriginalData([]);
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex-1 bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white px-4 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-all duration-300 shadow-lg min-w-[180px]"
              >
                <Trash2 className="h-5 w-5" />
                Clear Data
              </motion.button>
            </div>
          </div>
        )}

        {/* Data Table Card with Tabs */}
        {(data.length > 0 || originalData.length > 0) && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-lg">
            <div className="p-5 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-white mb-4">
                Excel Data
              </h2>

              {/* Tabs */}
              <div className="flex border-b border-gray-800">
                <button
                  onClick={() => setActiveTab("generated")}
                  className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
                    activeTab === "generated"
                      ? "text-emerald-500 border-b-2 border-emerald-500"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Table className="h-4 w-4" />
                  Generated Data
                </button>
                <button
                  onClick={() => setActiveTab("original")}
                  className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors ${
                    activeTab === "original"
                      ? "text-emerald-500 border-b-2 border-emerald-500"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Original Sheet
                </button>
              </div>
            </div>

            <div className="p-5">
              {activeTab === "generated" && data.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="text-gray-400 mb-3 text-sm">
                    Showing {data.length} rows of processed data
                  </p>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-left">
                        {Object.keys(data[0] || {}).map((key) => (
                          <th
                            key={key}
                            className="p-3 border-b border-gray-700 font-medium text-gray-300"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={!initialDataAnimated.current}>
                        {data.map((row, index) => (
                          <motion.tr
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{
                              duration: 0.3,
                              delay: initialDataAnimated.current
                                ? 0
                                : index * 0.05,
                              ease: "easeOut",
                            }}
                            onAnimationComplete={() => {
                              if (index === data.length - 1) {
                                initialDataAnimated.current = true;
                              }
                            }}
                            className={`hover:bg-gray-800/50 transition-colors ${
                              index % 2 === 0 ? "bg-gray-900" : "bg-gray-900/50"
                            }`}
                          >
                            {Object.values(row).map((value, i) => (
                              <td
                                key={i}
                                className="p-3 border-b border-gray-800 text-gray-300"
                              >
                                {value !== null && value !== undefined
                                  ? String(value)
                                  : ""}
                              </td>
                            ))}
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "generated" && data.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400">No generated data available</p>
                </div>
              )}

              {activeTab === "original" && originalData.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="text-gray-400 mb-3 text-sm">
                    Showing {originalData.length} rows from original Excel sheet
                  </p>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-left">
                        {Object.keys(originalData[0] || {}).map((key) => (
                          <th
                            key={key}
                            className="p-3 border-b border-gray-700 font-medium text-gray-300"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {originalData.map((row, index) => (
                        <tr
                          key={index}
                          className={`hover:bg-gray-800/50 transition-colors ${
                            index % 2 === 0 ? "bg-gray-900" : "bg-gray-900/50"
                          }`}
                        >
                          {Object.values(row).map((value, i) => (
                            <td
                              key={i}
                              className="p-3 border-b border-gray-800 text-gray-300"
                            >
                              {value !== null && value !== undefined
                                ? String(value)
                                : ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "original" && originalData.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400">No original data available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Download Filename Popup */}
      {showDownloadPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <h3 className="text-xl font-semibold text-white mb-4">
              Export Excel File
            </h3>
            <p className="text-gray-400 mb-4">
              Enter a name for your Excel file:
            </p>

            <input
              type="text"
              value={downloadFileName}
              onChange={(e) => setDownloadFileName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-white mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="filename.xlsx"
            />

            {isDownloading && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Preparing file...</span>
                  <span>{Math.round(downloadProgress)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    className="bg-emerald-500 h-2.5 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: `${downloadProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <motion.button
                onClick={() => setShowDownloadPopup(false)}
                disabled={isDownloading}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`px-4 py-2 rounded-md ${
                  isDownloading
                    ? "bg-gray-600 cursor-not-allowed"
                    : "bg-gray-700 hover:bg-gray-600"
                } text-white transition-all duration-300`}
              >
                Cancel
              </motion.button>
              <motion.button
                onClick={confirmDownload}
                disabled={isDownloading || !downloadFileName}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`px-4 py-2 rounded-md ${
                  isDownloading || !downloadFileName
                    ? "bg-emerald-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-800 to-emerald-600 hover:from-emerald-700 hover:to-emerald-500"
                } text-white transition-all duration-300 flex items-center gap-2 shadow-lg`}
              >
                {isDownloading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Validation Error Popup */}
      {showValidationPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-white">
                Validation Error
              </h3>
            </div>

            <div className="mb-6 bg-red-900/30 border border-red-800/50 rounded-md p-4">
              <p className="text-red-200">{validationError}</p>
            </div>

            <div className="bg-gray-800/50 rounded-md p-4 mb-6">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-300 font-medium">Required Format</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Your Excel file must include a column named &quot;Part&quot;
                    to be processed correctly.
                  </p>
                </div>
              </div>
            </div>

            {/* Example of correct Excel format */}
            <div className="bg-gray-800/50 rounded-md p-4 mb-6">
              <p className="text-gray-300 font-medium mb-2">
                Example of Valid Excel Format:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-700">
                      <th className="p-2 border border-gray-600 text-left font-medium text-emerald-400">
                        Part
                      </th>
                      <th className="p-2 border border-gray-600 text-left">
                        Description
                      </th>
                      <th className="p-2 border border-gray-600 text-left">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border border-gray-600 text-emerald-400">
                        ABC123
                      </td>
                      <td className="p-2 border border-gray-600">Widget A</td>
                      <td className="p-2 border border-gray-600">10</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-gray-600 text-emerald-400">
                        XYZ789
                      </td>
                      <td className="p-2 border border-gray-600">Widget B</td>
                      <td className="p-2 border border-gray-600">5</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end">
              <motion.button
                onClick={() => setShowValidationPopup(false)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 py-2 rounded-md bg-gradient-to-r from-emerald-800 to-emerald-600 hover:from-emerald-700 hover:to-emerald-500 text-white transition-all duration-300 shadow-lg"
              >
                Understood
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Global CSS for scrollbars */}
      <style jsx global>{`
        .scroll_off::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .scroll_off::-webkit-scrollbar-track {
          background: #1f2937;
          border-radius: 4px;
        }
        .scroll_off::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 4px;
        }
        .scroll_off::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
    </div>
  );
}
