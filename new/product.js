// Add product to the database
document.getElementById('addProductForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const name = document.getElementById('addName').value;
    const quantity = document.getElementById('addQuantity').value;
    const price = document.getElementById('addPrice').value;
    const reorderLevel = document.getElementById('addReorderLevel').value;

    const productData = {
      name: name,
      quantity: quantity,
      price: price,
      reorder_level: reorderLevel
    };

    // Make API request to add product
    fetch('http://localhost:3000/addProduct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    })
    .then(response => response.json())
    .then(data => {
      alert(data.message);
      document.getElementById('addProductForm').reset();
    })
    .catch(error => console.error('Error:', error));
  });

  // Update product in the database
  document.getElementById('updateProductForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const id = document.getElementById('updateId').value;
    const name = document.getElementById('updateName').value;
    const quantity = document.getElementById('updateQuantity').value;
    const price = document.getElementById('updatePrice').value;
    const reorderLevel = document.getElementById('updateReorderLevel').value;

    const productData = {
      name: name,
      quantity: quantity,
      price: price,
      reorder_level: reorderLevel
    };

    // Make API request to update product
    fetch(`http://localhost:3000/updateProduct/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    })
    .then(response => response.json())
    .then(data => {
      alert(data.message);
      document.getElementById('updateProductForm').reset();
    })
    .catch(error => console.error('Error:', error));
  });