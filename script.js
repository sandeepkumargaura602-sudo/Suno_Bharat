const SUPABASE_URL = "https://ejoyyrtfpkavoyujsrkv.supabase.co";
const SUPABASE_KEY = "sb_publishable_V4W--9Cb5MasMeCIie6TfQ_VFB9gUl2";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = (id) => document.getElementById(id);

let selectedFile = null;
let gps = null;


// ===============================
// PHOTO PREVIEW
// ===============================

$("photo").addEventListener("change", (e) => {

  selectedFile = e.target.files[0];

  if (!selectedFile) return;

  const reader = new FileReader();

  reader.onload = (event) => {
    $("preview").src = event.target.result;
    $("preview").style.display = "block";
    $("uploadPrompt").style.display = "none";
  };

  reader.readAsDataURL(selectedFile);
});


// ===============================
// GPS LOCATION
// ===============================

$("gpsBtn").addEventListener("click", () => {

  if (!navigator.geolocation) {
    $("gpsText").textContent =
      "Geolocation is not supported.";
    return;
  }

  $("gpsBtn").disabled = true;
  $("gpsBtn").textContent = "Getting location...";

  navigator.geolocation.getCurrentPosition(

    (position) => {

      gps = {
        lat: position.coords.latitude,
        lon: position.coords.longitude
      };

      $("gpsText").textContent =
        `Captured: ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;

      $("gpsBtn").disabled = false;
      $("gpsBtn").textContent = "✓ Location Captured";
    },

    () => {

      $("gpsText").textContent =
        "Permission denied/unavailable. Please allow location.";

      $("gpsBtn").disabled = false;
      $("gpsBtn").textContent = "Use My Location";
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
});


// ===============================
// SUBMIT ISSUE
// ===============================

$("reportForm").addEventListener("submit", async (e) => {

  e.preventDefault();

  $("message").textContent = "Submitting issue...";

  try {

    // Check login
    const {
      data: { user }
    } = await supabaseClient.auth.getUser();

    if (!user) {

      $("message").textContent =
        "Please login/signup first to submit an issue.";

      return;
    }


    // Check photo
    if (!selectedFile) {

      $("message").textContent =
        "Please add a photo.";

      return;
    }


    // Check GPS
    if (!gps) {

      $("message").textContent =
        "Please capture GPS location.";

      return;
    }


    // ===============================
    // UPLOAD PHOTO
    // ===============================

    const fileExtension =
      selectedFile.name.split(".").pop();

    const fileName =
      `${user.id}/${Date.now()}.${fileExtension}`;

    const filePath =
      `private/${fileName}`;


    const { error: uploadError } =
      await supabaseClient.storage
        .from("issue-photos")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false
        });


    if (uploadError) {
      throw uploadError;
    }


    // ===============================
    // GET PUBLIC PHOTO URL
    // ===============================

    const {
      data: publicUrlData
    } = supabaseClient.storage
      .from("issue-photos")
      .getPublicUrl(filePath);

    const photoUrl =
      publicUrlData.publicUrl;


    // ===============================
    // INSERT ISSUE INTO DATABASE
    // ===============================

    const { data: issue, error: issueError } =
      await supabaseClient
        .from("Issues")
        .insert({

          user_id: user.id,

          photo_url: photoUrl,

          category: $("category").value,

          description: $("description").value,

          location: $("location").value,

          latitude: gps.lat,

          longitude: gps.lon,

          status: "Reported",

          supporters: 0,

          verified: false,

          amplified: false

        })
        .select()
        .single();


    if (issueError) {
      throw issueError;
    }


    // ===============================
    // RESET FORM
    // ===============================

    $("reportForm").reset();

    selectedFile = null;
    gps = null;

    $("preview").style.display = "none";
    $("uploadPrompt").style.display = "block";

    $("gpsText").textContent =
      "Not captured yet";

    $("gpsBtn").disabled = false;
    $("gpsBtn").textContent =
      "Use My Location";


    $("message").textContent =
      "✓ Issue successfully submitted!";

    await renderIssues();

    $("issues").scrollIntoView({
      behavior: "smooth"
    });

  }

  catch (error) {

    console.error(error);

    $("message").textContent =
      "Error: " + error.message;
  }

});


// ===============================
// LOAD ISSUES FROM SUPABASE
// ===============================

async function renderIssues() {

  const {
    data: issues,
    error
  } = await supabaseClient
    .from("Issues")
    .select("*")
    .order("created_at", {
      ascending: false
    });


  if (error) {

    console.error(error);

    $("issueGrid").innerHTML = `
      <div class="issue-card">
        <div class="issue-body">
          <h3>Unable to load issues</h3>
          <p>${esc(error.message)}</p>
        </div>
      </div>
    `;

    return;
  }


  if (!issues || issues.length === 0) {

    $("issueGrid").innerHTML = `
      <div class="issue-card">
        <div class="issue-body">
          <h3>No reports yet</h3>
          <p>Be the first citizen to report a civic issue.</p>
        </div>
      </div>
    `;

    updateDashboard([]);
    return;
  }


  // Get real supporter records
  const {
    data: supports,
    error: supportError
  } = await supabaseClient
    .from("issue_supports")
    .select("issue_id");


  if (supportError) {
    console.error(supportError);
  }


  const supportCounts = {};

  (supports || []).forEach((support) => {

    supportCounts[support.issue_id] =
      (supportCounts[support.issue_id] || 0) + 1;

  });


  $("issueGrid").innerHTML =
    issues.map((issue) => {

      const realSupporters =
        supportCounts[issue.id] || 0;


      const score =
        Math.min(
          100,
          15 +
          realSupporters * 8 +
          (issue.verified ? 25 : 0) +
          (issue.amplified ? 20 : 0)
        );


      return `

        <article class="issue-card">

          <div class="issue-image">

            <img
              src="${esc(issue.photo_url || "")}"
              alt="Civic issue"
            >

            <span class="badge">
              ${esc(issue.status || "Reported")}
            </span>

          </div>


          <div class="issue-body">

            <span class="tag">
              ${esc(issue.category)}
            </span>

            <h3>
              ${esc(issue.description)}
            </h3>

            <p>
              📍 ${esc(issue.location)}
            </p>

            <p>
              GPS:
              ${Number(issue.latitude).toFixed(5)},
              ${Number(issue.longitude).toFixed(5)}
            </p>

            <p>
              Verification:
              <strong>
                ${issue.verified
          ? "Verified ✓"
          : "Pending"
        }
              </strong>
            </p>


            <div class="priority">

              <span
                style="--score:${score}%"
              ></span>

            </div>


            <div class="issue-actions">

              <strong>
                ${realSupporters} supports
              </strong>


              <button
                onclick="supportIssue(${issue.id})"
              >
                Support +
              </button>


              <button
                onclick="amplifyIssue(${issue.id})"
              >
                ${issue.amplified
          ? "Amplified ✓"
          : "Amplify"
        }
              </button>

            </div>

          </div>

        </article>

      `;

    }).join("");


  updateDashboard(
    issues,
    supportCounts
  );
}


// ===============================
// SUPPORT ISSUE
// ===============================

async function supportIssue(issueId) {

  try {

    const {
      data: { user }
    } = await supabaseClient.auth.getUser();


    if (!user) {

      alert(
        "Please login/signup before supporting an issue."
      );

      return;
    }


    const {
      error
    } = await supabaseClient
      .from("issue_supports")
      .insert({

        issue_id: issueId,

        user_id: user.id

      });


    if (error) {

      if (
        error.code === "23505"
      ) {

        alert(
          "You have already supported this issue."
        );

      } else {

        throw error;

      }

      return;
    }


    await renderIssues();

  }

  catch (error) {

    console.error(error);

    alert(
      "Unable to support issue: " +
      error.message
    );
  }
}


// ===============================
// AMPLIFY ISSUE
// ===============================

async function amplifyIssue(issueId) {

  try {

    const {
      data: { user }
    } = await supabaseClient.auth.getUser();


    if (!user) {

      alert(
        "Please login/signup before amplifying an issue."
      );

      return;
    }


    const {
      error
    } = await supabaseClient
      .from("Issues")
      .update({
        amplified: true
      })
      .eq("id", issueId);


    if (error) {
      throw error;
    }


    await renderIssues();

  }

  catch (error) {

    console.error(error);

    alert(
      "Unable to amplify issue: " +
      error.message
    );
  }
}


// ===============================
// DASHBOARD
// ===============================

function updateDashboard(
  issues,
  supportCounts = {}
) {

  $("totalCount").textContent =
    issues.length;


  $("verifiedCount").textContent =
    issues.filter(
      (issue) => issue.verified
    ).length;


  const totalSupports =
    Object.values(
      supportCounts
    ).reduce(
      (sum, count) => sum + count,
      0
    );


  $("supportCount").textContent =
    totalSupports;


  $("amplifyCount").textContent =
    issues.filter(
      (issue) => issue.amplified
    ).length;
}


// ===============================
// ESCAPE HTML
// ===============================

function esc(value) {

  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      (character) => {

        return {

          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"

        }[character];

      }
    );
}


// ===============================
// START
// ===============================

renderIssues();