import React, { useState } from "react";
import "./Explorer.styles.css";
//import { MiniatureTimeline } from "../MiniatureTimeline/MiniatureTimeline";
import VerticalLoadingLine from "@/components/VerticalLoading/VerticalLoading";
import { useFetch } from "@/hooks/useFetch";

const fetchFiles = () => {
  return fetch("http://localhost:3000/files")
    .then((response) => response.json())
    .then((data) => {
      return data;
    });
};

const downloadFile = async (yt_link) => {
  try {
    const response = await fetch("http://localhost:3000/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ yt_link }),
    });
  } catch (error) {
    console.error("Error in downloadFile:", error);
    throw error;
  }
};

const DraggableItem = ({ text, children }) => {
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleDragStart = (event) => {
    event.dataTransfer.setData("text/plain", text);
    setDragging(true);
  };

  const handleDrag = (event) => {
    if (event.clientX !== 0 && event.clientY !== 0) {
      setPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleDragEnd = () => {
    setDragging(false);
  };

  return (
    <>
      {/* Elemento que se arrastra */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className="cursor-grab p-0.5"
      >
        {children}
      </div>

      {/* Div flotante visible mientras se arrastra */}
      {dragging && (
        <div style={{ top: position.y + 10, left: position.x + 10 }}></div>
      )}
    </>
  );
};

const FileItem = ({ file, handleDeleteFile }) => {
  return (
    <DraggableItem text={file.mp3}>
      <div className="FileItem__container">
        {/* <MiniatureTimeline url={file.mp3} /> */}
        <img src={`http://localhost:3000/${file.thumbnail}`} alt="thumbnail" />
        <p>{file.mp3}</p>
        <button
          className="FileItem__delete-button"
          onClick={handleDeleteFile(file.mp3)}
        >
          <img
            src="/trash.svg"
            alt="Delete"
            className="FileItem__delete-icon"
          />
        </button>
      </div>
    </DraggableItem>
  );
};

export const Explorer = () => {
  const [visible, setIsVisible] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const { isloading, data, refetch } = useFetch(fetchFiles, "");
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (e) => {
    if (e.key === "Enter") {
      try {
        setDownloading(true);
        await downloadFile(urlValue);
        setUrlValue("");
        setDownloading(false);
        await refetch();
      } catch (error) {
        console.error("Error downloading file:", error);
      }
    }
  };

  const handleDeleteFile = (fileName) => (e) => {
    e.preventDefault();
    fetch(`http://localhost:3000/delete`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileName }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to delete file");
        }
      })
      .then(() => {
        console.log(`File ${fileName} deleted successfully`);
        refetch();
      })
      .catch((error) => {
        console.error("Error deleting file:", error);
      });
  };

  return (
    <>
      <div className="explorer__icon" onMouseEnter={() => setIsVisible(true)}>
        Files
      </div>
      <div
        className={`explorer ${visible ? "explorer--visible" : ""}`}
        onMouseLeave={() => setIsVisible(false)}
      >
        <div className="explorer__input-container">
          <VerticalLoadingLine
            isLoading={downloading}
            width="100%"
            height="40px"
            animationDuration="3s"
          >
            <input
              className="explorer__input-download"
              type="text"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={handleDownload}
              placeholder="Enter YouTube URL and press Enter"
            />
          </VerticalLoadingLine>
        </div>

        <div
          className={`explorer__files ${
            visible ? "explorer__files--visible" : ""
          }`}
        >
          <VerticalLoadingLine isLoading={isloading} width="100%" height="100%">
            <>
              {data?.map((file) => (
                <FileItem
                  key={file.mp3}
                  file={file}
                  handleDeleteFile={handleDeleteFile}
                />
              ))}
            </>
          </VerticalLoadingLine>
        </div>
      </div>
    </>
  );
};
