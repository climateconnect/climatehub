import { Button } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import DownloadIcon from "@mui/icons-material/Download";
import { toDataURL } from "qrcode";
import React, { useEffect, useState } from "react";

const useStyles = makeStyles(() => ({
  qrImage: {
    display: "block",
    width: 160,
    height: 160,
    //scale: 1 gives 1 pixel per QR module; nearest-neighbor upscale keeps every
    //module edge perfectly sharp on any display density
    imageRendering: "pixelated",
  },
}));

type QrCodeDownloadProps = {
  url: string;
  fileName: string;
  downloadButtonText: string;
  altText: string;
};

//Renders a QR code linking to the given url. The PNG is generated in print
//quality (1024px) and can be downloaded e.g. for use on flyers and posters.
export default function QrCodeDownload({
  url,
  fileName,
  downloadButtonText,
  altText,
}: QrCodeDownloadProps) {
  const classes = useStyles();
  const [displayUrl, setDisplayUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  useEffect(() => {
    //scale: 1 = 1 pixel per QR module; upscaled with image-rendering: pixelated
    //for perfectly sharp edges on screen at any display density
    toDataURL(url, { scale: 1, margin: 1 })
      .then(setDisplayUrl)
      .catch((error) => console.error(error));
    //high-resolution version for print/download (flyers, posters)
    toDataURL(url, { width: 1024, margin: 1 })
      .then(setDownloadUrl)
      .catch((error) => console.error(error));
  }, [url]);

  if (!displayUrl) return null;

  return (
    <>
      <img src={displayUrl} className={classes.qrImage} alt={altText} />
      <Button
        variant="contained"
        color="primary"
        href={downloadUrl}
        download={fileName}
        startIcon={<DownloadIcon />}
      >
        {downloadButtonText}
      </Button>
    </>
  );
}
