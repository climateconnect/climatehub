const DEVELOPMENT = ["development", "develop", "test"].includes(process.env.ENVIRONMENT!);

export function getLogoSrc(variant: "normal" | "white" = "normal", locale?: string): string {
  const base = variant === "white" ? "logo_white" : "logo";
  const langSuffix = locale === "de" ? "_de" : "";
  return `/images/${base}${langSuffix}.svg`;
}

export function getImageUrl(url) {
  if (!url) return;
  if (DEVELOPMENT && !url.includes("http:") && !url.includes("https:")) {
    return process.env.API_URL + url;
  } else {
    return url;
  }
}

export function getImageDialogHeight(screenWidth) {
  return (screenWidth / 16) * 9 * 0.7;
}

export async function getResizedImage(
  blob: string,
  width,
  height,
  type,
  forceExactSize?: boolean
): Promise<string> {
  //only resize by factors of 2, otherwise we'll lose quality
  const image = new Image();
  image.src = blob;
  return new Promise(function (resolve) {
    image.onload = async function () {
      if (image.width / 2 > width || image.height / 2 > height) {
        const blob = await getResizedBlob(image, image.width / 2, image.height / 2, type);
        resolve(await getResizedImage(blob, width, height, type, forceExactSize));
      } else if (forceExactSize && image.width > width) {
        const blob = await getResizedBlob(image, width, height, type);
        resolve(await getResizedImage(blob, width, height, type, forceExactSize));
      } else {
        resolve(blob);
      }
    };
  });
}

function getResizedBlob(image, width, height, type): Promise<string> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, width, height);
  return new Promise(function (resolve) {
    canvas.toBlob(function (blob) {
      resolve(URL.createObjectURL(blob!));
    }, type);
  });
}

export function whitenTransparentPixels(canvas) {
  const ctx = canvas.getContext("2d");
  const imgd = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pix = imgd.data;
  for (var i = 0, n = pix.length; i < n; i += 4) {
    var r = pix[i],
      g = pix[i + 1],
      b = pix[i + 2],
      a = pix[i + 3];

    if (r == 0 && g == 0 && b == 0 && a == 0) {
      // Change the white to the new color.
      pix[i] = 255;
      pix[i + 1] = 255;
      pix[i + 2] = 255;
      pix[i + 3] = 255;
    }
  }
  ctx.putImageData(imgd, 0, 0);
}

export async function convertToJPGWithAspectRatio(file): Promise<string> {
  const canvas = document.createElement("canvas");
  const image = new Image();
  return new Promise(function (resolve, reject) {
    image.onload = function () {
      drawImageOnCanvas(image, canvas);
      canvas.toBlob(
        async function (blob) {
          try {
            if (blob) {
              resolve(URL.createObjectURL(blob));
            } else {
              reject(new Error("Failed to create blob"));
            }
          } catch (error) {
            console.log(error);
            reject(error);
          }
        },
        "image/jpeg",
        1
      );
    };
    image.onerror = function () {
      reject(new Error("Failed to load image: file may be corrupt or truncated"));
    };
    image.src = URL.createObjectURL(file);
  });
}

const drawImageOnCanvas = (image, canvas) => {
  const context = canvas.getContext("2d");
  if (image.width / image.height === 16 / 9) {
    //image has right proportions already
    canvas.width = image.width;
    canvas.height = image.height;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
  } else if (image.width / image.height > 16 / 9) {
    //the image is too wide
    canvas.width = image.width;
    canvas.height = image.width * (9 / 16);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const heightDifference = canvas.height - image.height;
    context.drawImage(image, 0, heightDifference / 2);
  } else {
    //the image is too tall
    canvas.width = image.width * (16 / 9);
    canvas.height = image.height;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const widthDifference = canvas.width - image.width;
    context.drawImage(image, widthDifference / 2, 0);
  }
};

export async function blobFromObjectUrl(objectUrl: string): Promise<string> {
  try {
    const response = await fetch(objectUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    const originalBlob = await response.blob();

    const mimeType = originalBlob.type || "image/jpeg";

    // Derive a reasonable filename from the URL and/or MIME type
    let fileName = "image";
    try {
      const url = new URL(objectUrl);
      const lastSegment = url.pathname.split("/").pop();
      if (lastSegment) {
        fileName = lastSegment;
      }
    } catch {
      // objectUrl might be a blob: URL or otherwise not parseable by URL; fall back to default name
    }

    if (!fileName.includes(".")) {
      let extension = "jpg";
      if (mimeType === "image/png") {
        extension = "png";
      } else if (mimeType === "image/webp") {
        extension = "webp";
      } else if (mimeType === "image/gif") {
        extension = "gif";
      } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
        extension = "jpg";
      }
      fileName = `${fileName}.${extension}`;
    }

    // Convert Blob to File to ensure all File properties (like name) exist
    const file = new File([originalBlob], fileName, { type: mimeType });

    const { default: Compressor } = await import("compressorjs");

    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      new Compressor(file, {
        checkOrientation: true,
        //compress images larger than 500KB, otherwise just return the original blob
        convertSize: 500000,
        mimeType,
        quality: mimeType === "image/png" ? 0.9 : 0.8,
        strict: true,
        success(result) {
          resolve(result);
        },
        error(error) {
          reject(error);
        },
      });
    });

    // Convert compressed blob to base64 data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target!.result as string);
      };
      reader.onerror = () => {
        reject(new Error("Failed to read compressed image"));
      };
      reader.readAsDataURL(compressedBlob);
    });
  } catch (error) {
    console.error("Image compression failed:", error);
    throw new Error(`Failed to compress image from ${objectUrl}: ${error}`);
  }
}
