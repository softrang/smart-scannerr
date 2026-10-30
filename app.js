
/* =========================================================
   A3 SMART SCANNER
   Complete app.js
   Features:
   - Mobile Camera
   - Image Upload
   - OpenCV Auto Crop
   - Perspective Correction
   - A3 / A4 PDF
   - Multi-page PDF
   - JPG Download
   - Print
   ========================================================= */


/* =========================
   1. ELEMENTS
   ========================= */

const $ = id => document.getElementById(id);

const video = $("video");
const hint = $("cameraHint");
const pagesBox = $("pages");

let stream = null;
let pages = [];
let cvReady = false;


/* =========================
   2. CAMERA UI
   ========================= */

function setCameraUI(on) {

    $("start").disabled = on;
    $("stop").disabled = !on;
    $("capture").disabled = !on;

    video.style.display = on ? "block" : "none";
    hint.style.display = on ? "none" : "block";

}


/* =========================
   3. OPENCV INITIALIZATION
   ========================= */

function waitOpenCV() {

    return new Promise(resolve => {

        let tries = 0;

        const timer = setInterval(() => {

            try {

                if (
                    window.cv &&
                    typeof cv.Mat === "function" &&
                    typeof cv.findContours === "function" &&
                    typeof cv.warpPerspective === "function"
                ) {

                    // Runtime readiness check
                    if (cv.calledRun === false) {
                        return;
                    }

                    clearInterval(timer);

                    cvReady = true;

                    console.log("OpenCV Ready");

                    resolve(true);

                    return;
                }

            } catch (error) {

                console.warn("Waiting for OpenCV...", error);

            }

            tries++;

            if (tries > 120) {

                clearInterval(timer);

                cvReady = false;

                console.error("OpenCV load timeout");

                resolve(false);

            }

        }, 250);

    });

}


/* =========================
   4. START CAMERA
   ========================= */

$("start").addEventListener("click", async () => {

    try {

        if (!navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia) {

            alert(
                "আপনার Browser Camera API সাপোর্ট করছে না। HTTPS ব্যবহার করুন।"
            );

            return;
        }

        stream = await navigator.mediaDevices.getUserMedia({

            video: {

                facingMode: {
                    ideal: "environment"
                },

                width: {
                    ideal: 2560
                },

                height: {
                    ideal: 1920
                }

            },

            audio: false

        });

        video.srcObject = stream;

        await video.play();

        setCameraUI(true);

    } catch (error) {

        console.error("Camera Error:", error);

        alert(
            "ক্যামেরা চালু করা যায়নি। Camera Permission Allow করুন এবং HTTPS ব্যবহার করুন।"
        );

    }

});


/* =========================
   5. STOP CAMERA
   ========================= */

$("stop").addEventListener("click", stopCamera);


function stopCamera() {

    if (stream) {

        stream.getTracks().forEach(track => {

            track.stop();

        });

    }

    stream = null;

    video.srcObject = null;

    setCameraUI(false);

}


/* =========================
   6. CAPTURE IMAGE
   ========================= */

$("capture").addEventListener("click", () => {

    if (!video.videoWidth || !video.videoHeight) {

        alert("ক্যামেরা প্রস্তুত হয়নি।");

        return;

    }

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );

    addPage(canvas);

});


/* =========================
   7. UPLOAD IMAGE
   ========================= */

$("upload").addEventListener("click", () => {

    $("file").click();

});


$("file").addEventListener("change", event => {

    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {

        alert("একটি Image File নির্বাচন করুন।");

        return;

    }

    const image = new Image();

    image.onload = () => {

        const canvas = document.createElement("canvas");

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        const ctx = canvas.getContext("2d");

        ctx.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
        );

        addPage(canvas);

        URL.revokeObjectURL(image.src);

    };

    image.onerror = () => {

        alert("ছবিটি লোড করা যায়নি।");

    };

    image.src = URL.createObjectURL(file);

    event.target.value = "";

});


/* =========================
   8. ADD PAGE
   ========================= */

function addPage(source) {

    const processed = autoCrop(source);

    pages.push(processed);

    renderPages();

}


/* =========================
   9. AUTO CROP
   ========================= */

function autoCrop(source) {

    if (!cvReady || !window.cv) {

        console.warn(
            "OpenCV is not ready. Original image returned."
        );

        return source;

    }

    let src = null;
    let gray = null;
    let blur = null;
    let edges = null;

    let contours = null;
    let hierarchy = null;
    let kernel = null;

    let dst = null;
    let srcPts = null;
    let M = null;
    let out = null;

    try {

        // Read source image
        src = cv.imread(source);

        gray = new cv.Mat();
        blur = new cv.Mat();
        edges = new cv.Mat();

        // Convert to grayscale
        cv.cvtColor(
            src,
            gray,
            cv.COLOR_RGBA2GRAY
        );

        // Reduce noise
        cv.GaussianBlur(
            gray,
            blur,
            new cv.Size(5, 5),
            0
        );

        // Detect edges
        cv.Canny(
            blur,
            edges,
            50,
            150
        );

        // Connect nearby edges
        kernel = cv.Mat.ones(
            5,
            5,
            cv.CV_8U
        );

        cv.dilate(
            edges,
            edges,
            kernel
        );

        // Find contours
        contours = new cv.MatVector();

        hierarchy = new cv.Mat();

        cv.findContours(
            edges,
            contours,
            hierarchy,
            cv.RETR_LIST,
            cv.CHAIN_APPROX_SIMPLE
        );

        let best = null;

        let bestArea = 0;

        const totalArea =
            src.cols * src.rows;

        // Find largest suitable 4-corner contour
        for (
            let i = 0;
            i < contours.size();
            i++
        ) {

            const contour = contours.get(i);

            const approx = new cv.Mat();

            try {

                const perimeter = cv.arcLength(
                    contour,
                    true
                );

                cv.approxPolyDP(
                    contour,
                    approx,
                    0.02 * perimeter,
                    true
                );

                const area = Math.abs(
                    cv.contourArea(approx)
                );

                if (
                    approx.rows === 4 &&
                    area > totalArea * 0.15 &&
                    area > bestArea
                ) {

                    const points = [];

                    /*
                       IMPORTANT:
                       OpenCV point data is read from data32S.
                       intAt(j, 0) / intAt(j, 1) is incorrect
                       for this 4-point contour representation.
                    */

                    const data = approx.data32S;

                    for (let j = 0; j < 4; j++) {

                        points.push({

                            x: data[j * 2],

                            y: data[j * 2 + 1]

                        });

                    }

                    best = points;

                    bestArea = area;

                }

            } finally {

                contour.delete();

                approx.delete();

            }

        }


        // No suitable document found
        if (!best) {

            console.warn(
                "Document boundary not detected."
            );

            return source;

        }


        // Order points
        const pts = orderPoints(best);


        // Calculate output dimensions
        const width = Math.max(

            dist(
                pts[0],
                pts[1]
            ),

            dist(
                pts[2],
                pts[3]
            )

        );


        const height = Math.max(

            dist(
                pts[0],
                pts[3]
            ),

            dist(
                pts[1],
                pts[2]
            )

        );


        if (
            !Number.isFinite(width) ||
            !Number.isFinite(height) ||
            width < 10 ||
            height < 10
        ) {

            return source;

        }


        // Destination points
        dst = cv.matFromArray(

            4,

            1,

            cv.CV_32FC2,

            [

                0,
                0,

                width - 1,
                0,

                width - 1,
                height - 1,

                0,
                height - 1

            ]

        );


        // Source points
        srcPts = cv.matFromArray(

            4,

            1,

            cv.CV_32FC2,

            pts.flatMap(point => [

                point.x,

                point.y

            ])

        );


        // Perspective transformation
        M = cv.getPerspectiveTransform(

            srcPts,

            dst

        );


        out = new cv.Mat();


        // Warp image
        cv.warpPerspective(

            src,

            out,

            M,

            new cv.Size(

                Math.round(width),

                Math.round(height)

            ),

            cv.INTER_LINEAR,

            cv.BORDER_CONSTANT,

            new cv.Scalar(
                255,
                255,
                255,
                255
            )

        );


        // Create output canvas
        const result = document.createElement("canvas");

        result.width = Math.round(width);

        result.height = Math.round(height);


        // Render OpenCV output
        cv.imshow(
            result,
            out
        );


        console.log(
            "Auto Crop Successful",
            result.width,
            result.height
        );


        return result;


    } catch (error) {

        console.error(
            "Auto Crop Error:",
            error
        );

        return source;


    } finally {

        // Release OpenCV memory
        [

            src,
            gray,
            blur,
            edges,

            contours,
            hierarchy,
            kernel,

            dst,
            srcPts,
            M,
            out

        ].forEach(mat => {

            if (mat) {

                try {

                    mat.delete();

                } catch (error) {

                    console.warn(
                        "OpenCV cleanup error",
                        error
                    );

                }

            }

        });

    }

}


/* =========================
   10. ORDER POINTS
   ========================= */

function orderPoints(points) {

    const sum = points.map(
        point => point.x + point.y
    );

    const diff = points.map(
        point => point.x - point.y
    );


    const topLeft = points[

        sum.indexOf(
            Math.min(...sum)
        )

    ];


    const bottomRight = points[

        sum.indexOf(
            Math.max(...sum)
        )

    ];


    const topRight = points[

        diff.indexOf(
            Math.max(...diff)
        )

    ];


    const bottomLeft = points[

        diff.indexOf(
            Math.min(...diff)
        )

    ];


    return [

        topLeft,

        topRight,

        bottomRight,

        bottomLeft

    ];

}


/* =========================
   11. DISTANCE
   ========================= */

function dist(a, b) {

    return Math.hypot(

        a.x - b.x,

        a.y - b.y

    );

}


/* =========================
   12. RENDER PAGES
   ========================= */

function renderPages() {

    pagesBox.innerHTML = "";

    $("count").textContent =
        `${pages.length} page`;


    pages.forEach((canvas, index) => {

        const box = document.createElement("div");

        box.className = "page";


        const img = document.createElement("img");

        img.src = canvas.toDataURL(
            "image/jpeg",
            0.92
        );


        const meta = document.createElement("div");

        meta.className = "meta";


        const label = document.createElement("span");

        label.textContent =
            `পৃষ্ঠা ${index + 1}`;


        const del = document.createElement("button");

        del.textContent = "মুছুন";


        del.addEventListener("click", () => {

            pages.splice(
                index,
                1
            );

            renderPages();

        });


        meta.append(
            label,
            del
        );


        box.append(
            img,
            meta
        );


        pagesBox.append(box);

    });


    if (pages.length === 0) {

        pagesBox.innerHTML =

            '<div class="empty">' +

            'এখনো কোনো পৃষ্ঠা যোগ করা হয়নি' +

            '</div>';

    }


    [

        "pdf",

        "jpg",

        "print",

        "clear"

    ].forEach(id => {

        $(id).disabled =
            pages.length === 0;

    });

}


/* =========================
   13. CLEAR ALL PAGES
   ========================= */

$("clear").addEventListener("click", () => {

    pages = [];

    renderPages();

});


/* =========================
   14. DOWNLOAD HELPER
   ========================= */

function download(url, filename) {

    const link = document.createElement("a");

    link.href = url;

    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

}


/* =========================
   15. DOWNLOAD JPG
   ========================= */

$("jpg").addEventListener("click", () => {

    if (!pages.length) return;

    const lastPage =
        pages[pages.length - 1];


    const url = lastPage.toDataURL(
        "image/jpeg",
        0.95
    );


    download(

        url,

        `scan-${pages.length}.jpg`

    );

});


/* =========================
   16. MULTI-PAGE PDF
   ========================= */

$("pdf").addEventListener("click", () => {

    if (!pages.length) return;


    if (!window.jspdf) {

        alert(
            "PDF Library লোড হয়নি। Internet connection পরীক্ষা করুন।"
        );

        return;

    }


    const { jsPDF } = window.jspdf;


    const size = $("paper").value;


    const dimensions =

        size === "A3"

            ? [297, 420]

            : [210, 297];


    const doc = new jsPDF({

        orientation: "portrait",

        unit: "mm",

        format: size

    });


    pages.forEach((canvas, index) => {

        if (index > 0) {

            doc.addPage(
                size,
                "portrait"
            );

        }


        const image = canvas.toDataURL(

            "image/jpeg",

            0.95

        );


        const imageRatio =
            canvas.width / canvas.height;


        let width = dimensions[0];

        let height = dimensions[1];


        // Fit image inside selected paper
        if (
            imageRatio >
            dimensions[0] / dimensions[1]
        ) {

            height = width / imageRatio;

        } else {

            width = height * imageRatio;

        }


        const x =
            (dimensions[0] - width) / 2;


        const y =
            (dimensions[1] - height) / 2;


        doc.addImage(

            image,

            "JPEG",

            x,

            y,

            width,

            height

        );

    });


    doc.save(

        `A3-smart-scan-${Date.now()}.pdf`

    );

});


/* =========================
   17. PRINT
   ========================= */

$("print").addEventListener("click", () => {

    if (!pages.length) return;


    const win = window.open(
        "",
        "_blank"
    );


    if (!win) {

        alert(
            "Print window blocked. Pop-up অনুমতি দিন।"
        );

        return;

    }


    const paperSize =
        $("paper").value;


    const images = pages.map(canvas => {

        return `

            <img src="${canvas.toDataURL(
                "image/jpeg",
                0.95
            )}">

        `;

    }).join("");


    win.document.write(`

        <!doctype html>

        <html>

        <head>

            <title>Print Scans</title>

            <style>

                @page {

                    size: ${paperSize};

                    margin: 0;

                }

                body {

                    margin: 0;

                    padding: 0;

                }

                img {

                    width: 100%;

                    height: 100vh;

                    object-fit: contain;

                    page-break-after: always;

                }

            </style>

        </head>

        <body>

            ${images}

            <script>

                window.onload = function() {

                    window.print();

                };

            <\/script>

        </body>

        </html>

    `);


    win.document.close();

});


/* =========================
   18. INITIALIZATION
   ========================= */

waitOpenCV().then(ready => {

    if (ready) {

        console.log(
            "A3 Smart Scanner Ready"
        );

    } else {

        console.warn(

            "OpenCV unavailable. " +

            "Auto Crop will use original images."

        );

    }

});


/* =========================
   END OF APP.JS
   ========================= */
