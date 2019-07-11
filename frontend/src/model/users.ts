export class User {
    id: number;
    name: string;
    profilePicture: string;

    fromBundle(bundle): this {
        this.name = bundle['name'];
        this.profilePicture = bundle['profile_picture'];
        this.id = bundle['id'];

        return this;
    }
}
