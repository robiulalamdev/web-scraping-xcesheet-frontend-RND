"use client";

import type React from "react";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import {
  Upload,
  Download,
  X,
  FileSpreadsheet,
  AlertCircle,
  Save,
} from "lucide-react";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = "http://localhost:9700";
// const API_URL = "https://web-scraping-xcesheet-backend.onrender.com";

export default function ExcelFileManager() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [data, setData] = useState<object[]>([]);
  const [sheets, setSheets] = useState<object[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState("");
  const [connectionId, setConnectionId] = useState<string>("");

  // Ref to track if we've animated the initial data load
  const initialDataAnimated = useRef(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      setError(null);
      // Reset progress when a new file is selected
      setUploadProgress(0);
    }
  };

  const connectToServer = async () => {
    try {
      // Generate a unique identifier for the connection
      const uui = await uuidv4();

      if (uui) {
        setConnectionId(uui);
        const source = new EventSource(`${API_URL}/sse-connect/${uui}`);
        source.onopen = () => {
          console.log("Connected to server");
        };
        source.onerror = (error) => {
          console.error("Error connecting to server:", error);
          setError("Error connecting to server. Please try again.");
        };
        source.onmessage = (event) => {
          const newData = JSON.parse(event.data);
          const row = newData?.row;
          if (row) {
            setData((prevData) => [...prevData, row]);
          }
          if (newData?.success === true) {
            if (newData?.data) {
              setData(newData?.data);
              initialDataAnimated.current = false; // Reset animation flag for new data
            }
            source.close();
          }
        };
      }
    } catch (error) {
      console.error("Error connecting to server:", error);
      setError("Error connecting to server. Please try again.");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first!");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    // Simulate progress during file reading
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        const newProgress = prev + Math.random() * 5;
        return newProgress < 90 ? newProgress : 90;
      });
    }, 200);

    // need to convert selected file as array by xlsx
    const reader = new FileReader();
    reader.readAsBinaryString(selectedFile);

    reader.onload = async (e) => {
      if (!e.target?.result) return;

      const binaryStr = e.target.result as string;
      const workbook = XLSX.read(binaryStr, { type: "binary" });
      const sheetName = workbook.SheetNames[0]; // Read the first sheet
      const sheet = workbook.Sheets[sheetName];
      const extractData = await XLSX.utils.sheet_to_json(sheet);

      if (extractData) {
        await setSheets(() => [...(extractData as object[])]);
      }
    };

    if (sheets.length === 0) {
      setError("No data found in the selected file.");
      setIsUploading(false);
      clearInterval(progressInterval);
      return;
    }

    try {
      await axios.post(
        `${API_URL}/scrape`,
        {
          sheets: sheets,
          connectionId: connectionId,
        },
        {
          headers: { "Content-Type": "application/json" },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 100)
            );
            setUploadProgress(90 + percentCompleted / 10); // Final 10% based on actual upload
          },
        }
      );
      setUploadProgress(100);
    } catch (error) {
      console.error("Upload failed:", error);
      setError("Upload failed. Please try again.");
    } finally {
      clearInterval(progressInterval);
      setIsUploading(false);
    }
  };

  const handleDownload = () => {
    if (!filePath) return;
    const fileName = filePath.split("/").pop();
    window.open(`${API_URL}/download/${fileName}`);
  };

  const handleDelete = async () => {
    if (!filePath) return;
    const fileName = filePath.split("/").pop();

    try {
      await axios.delete(`${API_URL}/delete/${fileName}`);
      setFilePath(null);
      setData([]);
      setSelectedFile(null);
    } catch (error) {
      console.error("Delete failed:", error);
      setError("Delete failed. Please try again.");
    }
  };

  const handleExportToExcel = () => {
    if (data.length === 0) {
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
    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Convert data to worksheet
    const ws = XLSX.utils.json_to_sheet(data);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    // Generate filename with .xlsx extension if not present
    const filename = downloadFileName.endsWith(".xlsx")
      ? downloadFileName
      : `${downloadFileName}.xlsx`;

    // Write and download
    XLSX.writeFile(wb, filename);

    // Close popup
    setShowDownloadPopup(false);
  };

  useEffect(() => {
    connectToServer();
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-emerald-500 mb-2">
            Excel File Manager
          </h1>
          <p className="text-gray-400">
            Upload, view, and download Excel files
          </p>
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
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <input
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
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className={`min-w-32 px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2 
                  ${
                    !selectedFile || isUploading
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  } 
                  transition-colors`}
              >
                {isUploading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload File
                  </>
                )}
              </button>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="mt-4">
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {Math.round(uploadProgress)}% Complete
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* File Actions Card */}
        {(filePath || data.length > 0) && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-lg mb-8">
            <div className="p-5 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-white">File Actions</h2>
              <p className="text-gray-400 mt-1 text-sm">
                Download, export or delete the processed file
              </p>
            </div>
            <div className="p-5 flex flex-wrap gap-4">
              {filePath && (
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2 transition-colors min-w-[180px]"
                >
                  <Download className="h-4 w-4" />
                  Download Updated File
                </button>
              )}

              {data.length > 0 && (
                <button
                  onClick={handleExportToExcel}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2 transition-colors min-w-[180px]"
                >
                  <Save className="h-4 w-4" />
                  Export to Excel
                </button>
              )}

              {filePath && (
                <button
                  onClick={handleDelete}
                  className="flex-1 bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2 transition-colors min-w-[180px]"
                >
                  <X className="h-4 w-4" />
                  Cancel & Delete
                </button>
              )}
            </div>
          </div>
        )}

        {/* Data Table Card */}
        {data?.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-lg">
            <div className="p-5 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-white">
                Extracted Data
              </h2>
              <p className="text-gray-400 mt-1 text-sm">
                Showing {data.length} rows from the Excel file
              </p>
            </div>
            <div className="p-5">
              <div className="overflow-x-auto">
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
                              {String(value)}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
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

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDownloadPopup(false)}
                className="px-4 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDownload}
                className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
