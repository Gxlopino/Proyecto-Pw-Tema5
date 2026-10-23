// admin/controllers/usuario_controllers.js

export function home(req, res) {
  return res.render('usuario/home', {
    title: 'Mesa de Ayuda · Mis tickets',
    rol: 'usuario',
  });
}
