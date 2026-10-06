// routes/routes.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res)=>{
    res.render('')
});

router.post('/', (req, res)=>{

});

router.get('/usuarios', (req, res) => {

});

router.post('/usuarios', (req, res) => {

});

router.post('/produtos',(req, res)=>{

});

router.get('/produtos',(req, res)=>{

});


router.get('/produtos/:nome', (req, res) => {
  const nomeProduto = req.params.nome.toLowerCase();
  const produto = produtos.find(p => p.nome.toLowerCase() === nomeProduto);

  if (!produto) {
    return res.status(404).json({ mensagem: 'Produto não encontrado' });
  }

  res.json(produto);
});


router.get('/teast-finder', (req, res)=>{

});

router.post('/teast-finder', (req, res)=>{

});
module.exports = router;