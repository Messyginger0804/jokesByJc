document.addEventListener("DOMContentLoaded", () => {
    // Target the blog container for dynamic content
    const blogContainer = document.getElementById("blog-container");
  
    // Function to fetch blog data
    async function fetchBlog() {
      try {
        // Fetch blog data from the API
        const response = await fetch("https://blogsbyjc.vercel.app/api/blogs");
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
  
        const data = await response.json();
        const { title, snippet, url } = data;
  
        // Dynamically update the blog container
        blogContainer.innerHTML = `
          <h3>Current Blog</h3>
          <p><strong>${title}</strong></p>
          <p>${snippet}</p>
          <a href="${url}" target="_blank">Read More</a>
        `;
      } catch (error) {
        console.error("Failed to fetch blog:", error);
        blogContainer.innerHTML = `<p>Oops! Could not fetch the blog. Please try again later.</p>`;
      }
    }
  
    // Manual "useEffect": Call fetchBlog when the DOM is loaded
    fetchBlog();
  });
  
  