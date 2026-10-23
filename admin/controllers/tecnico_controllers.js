// admin/controllers/tecnico_controllers.js

export function home(req, res) {
  return res.render('tecnico/home', {
    title: 'Mesa de Ayuda · Atención',
    rol: 'tecnico',
  });
}
