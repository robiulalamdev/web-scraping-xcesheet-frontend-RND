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
} from "lucide-react";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "framer-motion";

const API_URL = process.env.NEXT_PUBLIC_BASE_URL;

export default function ExcelFileManager() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [data, setData] = useState<object[]>([]);
  // const [sheets, setSheets] = useState<object[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState("");
  const [connectionId, setConnectionId] = useState<string>("");

  // Ref to track if we've animated the initial data load
  const initialDataAnimated = useRef(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
      setError(null);
      setIsUploading(false);
      setData([]);
    }
  };

  const connectToServer = async () => {
    try {
      // Generate a unique identifier for the connection
      const uui = await uuidv4();

      if (uui) {
        setConnectionId(uui);
        // const source = new EventSource(`${API_URL}/sse-connect/${uui}`);
        // source.onopen = () => {
        //   console.log("Connected to server");
        // };
        // source.onerror = (error) => {
        //   console.error("Error connecting to server:", error);
        //   setError("Error connecting to server. Please try again.");
        // };
        // source.onmessage = (event) => {
        //   const newData = JSON.parse(event.data);
        //   const row = newData?.row;
        //   if (row) {
        //     setData((prevData) => [...prevData, row]);
        //   }
        //   if (newData?.success === true) {
        //     if (newData?.data) {
        //       setData(newData?.data);
        //       initialDataAnimated.current = false; // Reset animation flag for new data
        //     }
        //     source.close();
        //   }
        // };
      }
    } catch (error) {
      console.error("Error connecting to server:", error);
      setError("Error connecting to server. Please try again.");
    }
  };

  //** simplified two */
  // function chunkArray(array: object[], size: number) {
  //   return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
  //     array.slice(i * size, i * size + size)
  //   );
  // }

  // const handleUpload = async () => {
  //   if (!selectedFile) {
  //     setError("Please select a file first!");
  //     return;
  //   }

  //   setIsUploading(true);
  //   setError(null);

  //   // Convert file to JSON using xlsx
  //   const reader = new FileReader();
  //   reader.readAsBinaryString(selectedFile);

  //   reader.onload = async (e) => {
  //     if (!e.target?.result) return;

  //     const binaryStr = e.target.result as string;
  //     const workbook = XLSX.read(binaryStr, { type: "binary" });
  //     const sheetName = workbook.SheetNames[0];
  //     const sheet = workbook.Sheets[sheetName];
  //     const extractData = (await XLSX.utils.sheet_to_json(sheet)) as object[];

  //     if (!extractData?.length) {
  //       setError("No data found in the selected file.");
  //       setIsUploading(false);
  //       return;
  //     }

  //     const chunks = chunkArray(extractData, 5); // Split data into chunks of 5

  //     let lastPromise = Promise.resolve(); // Ensures order of setting data

  //     try {
  //       for (let i = 0; i < chunks.length; i += 2) {
  //         const chunk1 = chunks[i];
  //         const chunk2 = chunks[i + 1] || null; // Second chunk might not exist

  //         // Run both API calls in parallel
  //         const promise1 = axios.post(
  //           `${API_URL}/scrape`,
  //           { sheets: chunk1, connectionId },
  //           { headers: { "Content-Type": "application/json" }, timeout: 150000 }
  //         );
  //         const promise2 = chunk2
  //           ? axios.post(
  //               `${API_URL}/scrape`,
  //               { sheets: chunk2, connectionId },
  //               {
  //                 headers: { "Content-Type": "application/json" },
  //                 timeout: 150000,
  //               }
  //             )
  //           : null;

  //         // Store responses to ensure correct order
  //         const response1 = promise1.then((res) =>
  //           res?.data?.success ? res.data.data : []
  //         );
  //         const response2 = promise2
  //           ? promise2.then((res) => (res?.data?.success ? res.data.data : []))
  //           : Promise.resolve([]);

  //         // Wait for first response, then immediately set data
  //         lastPromise = lastPromise.then(async () => {
  //           const firstData = await response1;
  //           if (firstData.length) {
  //             setData((prevData) => [...prevData, ...firstData]);
  //           }

  //           // Now wait for second response
  //           const secondData = await response2;
  //           if (secondData.length) {
  //             setData((prevData) => [...prevData, ...secondData]);
  //           }
  //         });

  //         // Ensure this batch finishes before moving to the next one
  //         await lastPromise;
  //       }
  //     } catch (error) {
  //       console.error("Upload failed:", error);
  //       setError("Upload failed. Please try again.");
  //     } finally {
  //       setIsUploading(false);
  //     }
  //   };
  // };

  //* FIRST WAY
  function chunkArray(array: object[], size: number) {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
      array.slice(i * size, i * size + size)
    );
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first!");
      return;
    }

    setIsUploading(true);
    setError(null);

    // need to convert selected file as array by xlsx
    const reader = new FileReader();
    reader.readAsBinaryString(selectedFile);

    reader.onload = async (e) => {
      if (!e.target?.result) return;

      const binaryStr = e.target.result as string;
      const workbook = XLSX.read(binaryStr, { type: "binary" });
      const sheetName = workbook.SheetNames[0]; // Read the first sheet
      const sheet = workbook.Sheets[sheetName];
      const extractData = (await XLSX.utils.sheet_to_json(sheet)) as object[];

      if (extractData?.length > 0) {
        const chunks = chunkArray(extractData, 5);

        try {
          for (const chunk of chunks) {
            const response = await axios.post(
              `${API_URL}/scrape`,
              {
                sheets: chunk,
                connectionId: connectionId,
              },
              {
                headers: { "Content-Type": "application/json" },
                timeout: 150000,
              }
            );

            if (response?.data && response?.data?.success === true) {
              if (response?.data?.data?.length > 0) {
                setData((prevData) => [...prevData, ...response?.data?.data]);
              }
            }
          }
        } catch (error) {
          console.error("Upload failed:", error);
          setError("Upload failed. Please try again.");
        } finally {
          setIsUploading(false);
        }
      } else {
        setError("No data found in the selected file.");
        setIsUploading(false);
        return;
      }
    };
  };

  //*** MAIN CODE */
  // const handleUpload = async () => {
  //   if (!selectedFile) {
  //     setError("Please select a file first!");
  //     return;
  //   }

  //   setIsUploading(true);
  //   setError(null);

  //   // need to convert selected file as array by xlsx
  //   const reader = new FileReader();
  //   reader.readAsBinaryString(selectedFile);

  //   reader.onload = async (e) => {
  //     if (!e.target?.result) return;

  //     const binaryStr = e.target.result as string;
  //     const workbook = XLSX.read(binaryStr, { type: "binary" });
  //     const sheetName = workbook.SheetNames[0]; // Read the first sheet
  //     const sheet = workbook.Sheets[sheetName];
  //     const extractData = await XLSX.utils.sheet_to_json(sheet);

  //     if (extractData?.length > 0) {
  //       try {
  //         const response = await axios.post(
  //           `${API_URL}/scrape`,
  //           {
  //             sheets: extractData,
  //             connectionId: connectionId,
  //           },
  //           {
  //             headers: { "Content-Type": "application/json" },
  //           }
  //         );

  //         if (response?.data && response?.data?.success === true) {
  //           if (response?.data?.data?.length > 0) {
  //             setData(response?.data?.data);
  //           }
  //         }
  //       } catch (error) {
  //         console.error("Upload failed:", error);
  //         setError("Upload failed. Please try again.");
  //       } finally {
  //         setIsUploading(false);
  //       }
  //     } else {
  //       setError("No data found in the selected file.");
  //       setIsUploading(false);
  //       return;
  //     }
  //   };
  // };

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

            {isUploading && (
              <div className="mt-4">
                <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    className="bg-emerald-500 h-2.5 max-w-[75%] rounded-full"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: "linear",
                    }}
                  />
                </div>
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
        {data.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-lg mb-8">
            <div className="p-5 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-white">File Actions</h2>
              <p className="text-gray-400 mt-1 text-sm">
                Download, export or delete the processed file
              </p>
            </div>
            <div className="p-5 flex flex-wrap gap-4">
              {data.length > 0 && (
                <button
                  onClick={handleExportToExcel}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center justify-center gap-2 transition-colors min-w-[180px]"
                >
                  <Save className="h-4 w-4" />
                  Export to Excel
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
              <div className="overflow-y-scroll scroll_off">
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
