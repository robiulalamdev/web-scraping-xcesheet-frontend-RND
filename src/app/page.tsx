"use client";

import type React from "react";
import { useState } from "react";
import axios from "axios";
import {
  Upload,
  Download,
  X,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";

export default function ExcelFileManager() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [data, setData] = useState<object[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first!");
      return;
    }

    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axios.post(
        "http://localhost:9700/upload-excel",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      setFilePath(response.data.filePath);
      setData(response.data.data);
    } catch (error) {
      console.error("Upload failed:", error);
      setError("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = () => {
    if (!filePath) return;
    const fileName = filePath.split("/").pop();
    window.open(`http://localhost:9700/download/${fileName}`);
  };

  const handleDelete = async () => {
    if (!filePath) return;
    const fileName = filePath.split("/").pop();

    try {
      await axios.delete(`http://localhost:9700/delete/${fileName}`);
      setFilePath(null);
      setData([]);
      setSelectedFile(null);
    } catch (error) {
      console.error("Delete failed:", error);
      setError("Delete failed. Please try again.");
    }
  };

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

            {error && (
              <div className="mt-4 bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-md flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* File Actions Card */}
        {filePath && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-lg mb-8">
            <div className="p-5 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-white">File Actions</h2>
              <p className="text-gray-400 mt-1 text-sm">
                Download or delete the processed file
              </p>
            </div>
            <div className="p-5 flex gap-4">
              <button
                onClick={handleDownload}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Updated File
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <X className="h-4 w-4" />
                Cancel & Delete
              </button>
            </div>
          </div>
        )}

        {/* Data Table Card */}
        {data.length > 0 && (
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
                      {Object.keys(data[0]).map((key) => (
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
                    {data.map((row, index) => (
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
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
