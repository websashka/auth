import { Request, Response } from "express";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import * as bcrypt from "bcrypt";
import JWTService from "../services/jwt";

export class AuthController {
  static async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).send("Access Denied. No refresh token provided.");
    }
    const { id } = JWTService.decodePayload(refreshToken);
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    try {
      JWTService.verifyRefreshToken(refreshToken, user.sessionKey);
      const accessToken = JWTService.signAccessToken(
        { id: user.id },
        user.sessionKey,
      );
      const newRefreshToken = JWTService.signRefreshToken(
        { id: user.id },
        user.sessionKey,
      );
      return res
        .status(200)
        .json({ accessToken, refreshToken: newRefreshToken });
    } catch (error) {
      return res.status(400).send("Invalid refresh token.");
    }
  }

  static async logout(req: Request, res: Response) {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.sessionKey = await bcrypt.genSalt(6);
    await userRepository.save(user);
    res.status(200).json({});
  }

  static async getInfo(req: Request, res: Response) {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.status(200).json({ login: user.login });
  }

  static async signup(req: Request, res: Response) {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(500).json({ message: "Login and password required." });
    }

    const encryptedPassword = await bcrypt.hashSync(password, 12);
    const user = new User();
    user.login = login;
    user.password = encryptedPassword;
    user.sessionKey = await bcrypt.genSalt(6);

    const userRepository = AppDataSource.getRepository(User);
    await userRepository.save(user);

    const accessToken = JWTService.signAccessToken(
      { id: user.id },
      user.sessionKey,
    );
    const refreshToken = JWTService.signRefreshToken(
      { id: user.id },
      user.sessionKey,
    );

    return res.status(200).json({ accessToken, refreshToken });
  }
  static async login(req: Request, res: Response) {
    try {
      const { login, password } = req.body;
      if (!login || !password) {
        return res.status(500).json({ message: "Login and password required" });
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { login } });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isPasswordValid = bcrypt.compareSync(user.password, password);
      if (!isPasswordValid) {
        return res.status(404).json({ message: "Password invalid" });
      }

      const accessToken = JWTService.signAccessToken(
        { id: user.id },
        user.sessionKey,
      );
      const refreshToken = JWTService.signRefreshToken(
        { id: user.id },
        user.sessionKey,
      );

      return res.status(200).json({ accessToken, refreshToken });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}