document.addEventListener("DOMContentLoaded", async () => {
  const blogContainer = document.getElementById("blog-container");

  try {
    const response = await fetch("https://blogsbyjc.vercel.app/api/blogs");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const { title, url } = data;
    const image = `https://blogsbyjc.vercel.app/blog-images/jwt.png`

    console.log(data)


    blogContainer.innerHTML = `
      <h3>${title}</h3>
      <a href="${url}" target="_blank">
        <img src="${image}" alt="${title}" style="width: 150px; height: auto;" />
      </a>
    `;
  } catch (error) {
    console.error("Error fetching blog:", error);
    blogContainer.innerHTML = `<p>Failed to load the blog.</p>`;
  }
});
