import  { sendMailToUser, sendMailToRecoveryPassword} from "../config/nodemailer.js";
import SuperUsuario  from "../models/super_usuario.js";
import generarJWT from "../helpers/crearJWT.js";
import bcrypt from 'bcryptjs';

// Dentro de la función login, puedes utilizar esta función para verificar la contraseña
const login = async (req, res) => {
    const { email, password } = req.body;
    if (Object.values(req.body).includes("")) return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos" });

    try {
        const superUsuarioBDD = await SuperUsuario.findOne({
            where: { email },
            attributes: ['id', 'nombre', 'apellido', 'email', 'confirmemail', 'password']
        });

        if (!superUsuarioBDD) return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" });
        if (!superUsuarioBDD.confirmemail) return res.status(403).json({ msg: "Lo sentimos, debe verificar primero su cuenta" });

        const verificarPassword = await superUsuarioBDD.matchPassword(password);
        if (!verificarPassword) return res.status(401).json({ msg: "Lo sentimos, la contraseña no es correcta" });

        const token = generarJWT(superUsuarioBDD.id, "superUsuario");

        res.status(200).json({
            token,
            id: superUsuarioBDD.id,
            nombre: superUsuarioBDD.nombre,
            apellido: superUsuarioBDD.apellido,
            email: superUsuarioBDD.email,
        });
    } catch (error) {
        console.error("Error al iniciar sesión:", error.message);
        res.status(500).json({ msg: "Error interno del servidor" });
    }
};

const perfil = (req, res) => {
    const usuario = req.superUsuarioBDD;

    if (!usuario) {
        return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    // Excluir campos sensibles si es necesario (aunque ya excluiste 'password' en el middleware)
    delete usuario.token;
    delete usuario.confirmemail;

    res.status(200).json(usuario);
};

const registro = async (req, res) => {
    const { email, password } = req.body;
    if (Object.values(req.body).includes("")) return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos" });

    const verificarEmailBDD = await SuperUsuario.findOne({ where: { email: email } });
    if (verificarEmailBDD) return res.status(400).json({ msg: "Lo sentimos, el email ya se encuentra registrado" });

    // Crear un nuevo usuario y encriptar la contraseña en el hook
    const nuevoUsuario = new SuperUsuario(req.body);

    try {
        const token = await nuevoUsuario.crearToken();
        sendMailToUser(email, token);
        await nuevoUsuario.save(); // Guardar el usuario en la base de datos después de generar el token
        res.status(200).json({ msg: "Revisa tu correo electrónico para confirmar tu cuenta" });
    } catch (error) {
        return res.status(500).json({ msg: "Error interno del servidor" });
    }
};

const confirmEmail = async (req, res) => {
    const { token } = req.params;
    if (!token) return res.status(400).json({ msg: "Lo sentimos, no se puede validar la cuenta" });

    try {
        const superUsuarioBDD = await SuperUsuario.findOne({ where: { token } });

        if (!superUsuarioBDD) {
            return res.status(404).json({ msg: "Token inválido o la cuenta ya ha sido confirmada" });
        }

        // Actualizar confirmemail a true y limpiar el token
        superUsuarioBDD.confirmemail = true;
        superUsuarioBDD.token = null;
        await superUsuarioBDD.save();

        res.status(200).json({ msg: "Token confirmado, ya puedes iniciar sesión" });
    } catch (error) {
        console.error("Error al confirmar el correo electrónico:", error.message);
        res.status(500).json({ msg: "Error del servidor al confirmar el correo electrónico" });
    }
};



const listarSuperUsuarios = (req,res)=>{
    res.status(200).json({res:'lista de super_usuario registrados'})
}
const detalleSuperUsuarios= async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar si el ID es un entero válido
        if (isNaN(id)) {
            return res.status(404).json({ msg: "Lo sentimos, el ID debe ser un número entero válido" });
        }

        // Buscar al super usuario por su ID
        const superUsuarioBDD = await SuperUsuario.findByPk(id, { attributes: { exclude: ['password'] } });

        // Verificar si se encontró al super usuario
        if (!superUsuarioBDD) {
            return res.status(404).json({ msg: `Lo sentimos, no existe el super usuario con ID ${id}` });
        }

        // Si se encuentra, responder con los detalles del super usuario
        res.status(200).json({ msg: superUsuarioBDD });
    } catch (error) {
        console.error("Error al buscar el super usuario:", error.message);
        res.status(500).json({ msg: "Error del servidor" });
    }
};


const actualizarPerfil = async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar si el ID es un número entero válido
        if (isNaN(id)) {
            return res.status(404).json({ msg: "Lo sentimos, el ID debe ser un número entero válido" });
        }

        // Verificar si se proporcionaron todos los campos
        if (Object.values(req.body).some(value => value === undefined || value === '')) {
            return res.status(400).json({ msg: "Lo sentimos, debes llenar todos los campos" });
        }

        // Buscar al super usuario por su ID
        const superUsuarioBDD = await SuperUsuario.findByPk(id);

        // Verificar si se encontró al super usuario
        if (!superUsuarioBDD) {
            return res.status(404).json({ msg: `Lo sentimos, no existe el super usuario con ID ${id}` });
        }

        // Verificar si se está intentando cambiar el correo electrónico y si ya existe en otro usuario
        if (req.body.email && req.body.email !== superUsuarioBDD.email) {
            const superUsuarioExistente = await SuperUsuario.findOne({ where: { email: req.body.email } });
            if (superUsuarioExistente) {
                return res.status(400).json({ msg: "Lo sentimos, el correo electrónico ya está registrado en otro usuario" });
            }
        }

        // Actualizar los campos del super usuario
        await superUsuarioBDD.update(req.body);

        res.status(200).json({ msg: "Perfil actualizado correctamente" });
    } catch (error) {
        console.error("Error al actualizar el perfil:", error.message);
        res.status(500).json({ msg: "Error del servidor" });
    }
};

const actualizarPassword = async (req, res) => {
    const { id } = req.superUsuarioBDD; // Obtener el ID del super usuario desde la solicitud

    const { passwordactual, passwordnuevo, confirmpassword } = req.body;

    // Verificar si los campos están presentes
    if (!passwordactual || !passwordnuevo || !confirmpassword) {
        return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    // Verificar si la nueva contraseña y la confirmación de la contraseña coinciden
    if (passwordnuevo !== confirmpassword) {
        return res.status(400).json({ msg: "La nueva contraseña y la confirmación no coinciden" });
    }

    try {
        // Buscar al super usuario por su ID
        const superUsuarioBDD = await SuperUsuario.findByPk(id);

        // Verificar si se encontró al super usuario
        if (!superUsuarioBDD) {
            return res.status(404).json({ msg: `Lo sentimos, no existe el super usuario con ID ${id}` });
        }

        // Verificar si la contraseña actual es correcta
        const verificarPassword = await superUsuarioBDD.matchPassword(passwordactual);
        if (!verificarPassword) {
            return res.status(404).json({ msg: "Lo sentimos, la contraseña actual no es correcta" });
        }

        // Actualizar la contraseña del super usuario
        superUsuarioBDD.password = await superUsuarioBDD.encryptPassword(passwordnuevo);
        await superUsuarioBDD.save();

        res.status(200).json({ msg: "Contraseña actualizada correctamente" });
    } catch (error) {
        console.error("Error al actualizar la contraseña:", error.message);
        res.status(500).json({ msg: "Error del servidor" });
    }
};

const recuperarPassword = async (req, res) => {
    const { email } = req.body;
    // Verificar si se proporcionó un correo electrónico
    if (!email) {
        return res.status(400).json({ msg: "Debes proporcionar un correo electrónico" });
    }
    try {
        // Buscar al usuario en la base de datos
        const superUsuarioBDD = await SuperUsuario.findOne({ where: { email } });

        // Si no se encuentra al usuario, devolver un mensaje de error
        if (!superUsuarioBDD) {
            return res.status(404).json({ msg: "Lo sentimos, el usuario no se encuentra registrado" });
        }

        // Crear un token de recuperación de contraseña
        const token = await superUsuarioBDD.crearToken();

        // Actualizar el token y eliminar la contraseña
        superUsuarioBDD.token = token;
        superUsuarioBDD.password = '';  // Establecer la contraseña a una cadena vacía
        await superUsuarioBDD.save();

        // Enviar correo electrónico de recuperación de contraseña
        await sendMailToRecoveryPassword(email, token);

        // Respuesta exitosa
        res.status(200).json({ msg: "Revisa tu correo electrónico para restablecer tu contraseña" });
    } catch (error) {
        // Manejar errores
        console.error('Error al recuperar contraseña:', error.message);
        res.status(500).json({ msg: "Error interno del servidor" });
    }
};


const comprobarTokenPasword = async (req, res) => {
    const token = req.params.token;

    // Verificar si se proporcionó un token en los parámetros de la solicitud
    if (!token) {
        return res.status(404).json({ msg: "Lo sentimos, no se proporcionó un token válido" });
    }
    try {
        // Buscar al usuario en la base de datos utilizando el token
        const superUsuarioBDD = await SuperUsuario.findOne({ where: { token } });

        // Verificar si se encontró al usuario y si el token coincide
        if (!superUsuarioBDD || superUsuarioBDD.token !== token) {
            return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" });
        }
        // La cuenta ha sido validada, puedes realizar las operaciones necesarias aquí si es necesario

        res.status(200).json({ msg: "Token confirmado, ya puedes crear tu nueva contraseña" });
    } catch (error) {
        // Manejar errores
        console.error('Error al comprobar el token de contraseña:', error.message);
        res.status(500).json({ msg: "Error interno del servidor" });
    }
};

const nuevoPassword = async (req, res) => {
    const { password, confirmpassword } = req.body;
    // Verificar si se llenaron todos los campos
    if (Object.values(req.body).includes("")) {
        return res.status(404).json({ msg: "Lo sentimos, debes llenar todos los campos" });
    }
    // Verificar si las contraseñas coinciden
    if (password !== confirmpassword) {
        return res.status(404).json({ msg: "Lo sentimos, las contraseñas no coinciden" });
    }
    try {
        // Buscar al usuario en la base de datos utilizando el token
        const superUsuarioBDD = await SuperUsuario.findOne({ where: { token: req.params.token } });
        // Verificar si se encontró al usuario y si el token coincide
        if (!superUsuarioBDD || superUsuarioBDD.token !== req.params.token) {
            return res.status(404).json({ msg: "Lo sentimos, no se puede validar la cuenta" });
        }

        // Actualizar el token y la contraseña del usuario
        superUsuarioBDD.token = null;
        superUsuarioBDD.password = await superUsuarioBDD.encryptPassword(password);

        // Guardar los cambios en la base de datos
        await superUsuarioBDD.save();

        res.status(200).json({ msg: "¡Felicitaciones, ya puedes iniciar sesión con tu nueva contraseña!" });
    } catch (error) {
        // Manejar errores
        console.error('Error al actualizar la contraseña:', error.message);
        res.status(500).json({ msg: "Error interno del servidor" });
    }
};

export default {
    login,
    perfil,
    registro,
    confirmEmail,
    listarSuperUsuarios,
    detalleSuperUsuarios,
    actualizarPerfil,
    actualizarPassword,
    recuperarPassword,
    comprobarTokenPasword,
    nuevoPassword
};