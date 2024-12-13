document.addEventListener("DOMContentLoaded", async () => {
  const blogContainer = document.getElementById("blog-container");

  try {
    const response = await fetch("https://blogsbyjc.vercel.app/api/blogs");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const { title, url, snippet } = data;
    const mainImage = `https://blogsbyjc.vercel.app/blog-images/jwt.png`; // Main image
    const fakeImage = `./images/pointing.png`;

    blogContainer.innerHTML = `
      <div class="blog-layout">
        <a href="${url}" target="_blank" class="blog-image-wrapper">
          <img src="${mainImage}" alt="${title}" class="blog-image" />
        </a>
        <div class="blog-content">
          <a href="${url}" target="_blank" class="blog-title">
            ${title}
          </a>
          <p class="blog-description">${snippet}</p>
        </div>
      </div>
      <img src="${fakeImage}" alt="Fake description image" class="fake-image" />
    `;
  } catch (error) {
    console.error("Error fetching blog:", error);
    blogContainer.innerHTML = `<p>Failed to load the blog.</p>`;
  }
});
