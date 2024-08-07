import express from 'express';
const router = express.Router();
import superUsuarioController from "../controllers/super_usuario_controller.js";
import { verificarAutenticacion} from '../middlewares/autenticacion.js';
import { validacionSuperUsuario, validacionActualizarPassword, validarActualizacionPassword } from '../middlewares/validacionSuperUsuario.js';

// Ruta para iniciar sesión (login)
router.post('/login', superUsuarioController.login);
// Ruta para registro de nuevos usuarios
router.post('/registro', validacionSuperUsuario,superUsuarioController.registro);
// Ruta para confirmar email
router.get('/confirmar/:token', superUsuarioController.confirmEmail);
// Ruta para obtener la lista de usuarios
router.get('/usuarios', superUsuarioController.listarSuperUsuarios);
// Ruta para enviar email de recuperación de contraseña
router.post('/recuperar-password', superUsuarioController.recuperarPassword);
// Ruta para verificar token de recuperación de contraseña
router.get('/recuperar-password/:token', superUsuarioController.comprobarTokenPasword);
// Ruta para crear nueva contraseña con token de recuperación
router.post('/nuevo-password/:token',validacionActualizarPassword, superUsuarioController.nuevoPassword);
// Ruta para obtener perfil del usuario
router.get('/perfil',verificarAutenticacion, superUsuarioController.perfil);
// Ruta para actualizar contraseña del usuario admin
router.put('/usuario/actualizarpassword',verificarAutenticacion,validarActualizacionPassword, superUsuarioController.actualizarPassword);
// Ruta para obtener detalle de un usuario admin por su ID
router.get('/usuario/:id',verificarAutenticacion, superUsuarioController.detalleSuperUsuarios);
// Ruta para actualizar perfil de un usuario admin por su ID
router.put('/usuario/:id',verificarAutenticacion ,superUsuarioController.actualizarPerfil);

export default router;
