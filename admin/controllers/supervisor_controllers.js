// admin/controllers/supervisor_controllers.js

export function home(req, res) {
  return res.render('supervisor/home', {
    title: 'Mesa de Ayuda · Supervisión',
    rol: 'supervisor',
  });
}
